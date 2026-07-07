using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.AspNetCore.Mvc;
using System.ClientModel;
using OpenAI;
using Microsoft.IdentityModel.Tokens;
using Server.Services;
using Server.Models;
using Server.Data;
using Server.Middleware;


var builder = WebApplication.CreateBuilder(args);

// Core services
builder.Services.AddCors(o => o.AddDefaultPolicy(
    p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite("Data Source=ai_assistant_dev.db"));

// AI setup (optional)
string? apiKey = builder.Configuration["GoogleAI:ApiKey"];
if (string.IsNullOrWhiteSpace(apiKey)) apiKey = null;

builder.Services.AddScoped<Kernel>(sp =>
{
    var kernelBuilder = Kernel.CreateBuilder();

    if (apiKey is not null)
    {
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        kernelBuilder.AddOpenAIChatCompletion(
            modelId: "gemini-2.5-flash",
            apiKey: apiKey,
            endpoint: new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"),
            httpClient: httpClient);
    }

    var kernel = kernelBuilder.Build();

    var db = sp.GetRequiredService<AppDbContext>();
    kernel.Plugins.AddFromObject(new RecipeDataPlugin(db), "RecipeData");
    kernel.Plugins.AddFromObject(new PantryPlugin(db), "Pantry");

    return kernel;
});

// Auth and user services
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    e => e.Key,
                    e => e.Value!.Errors.Select(x => x.ErrorMessage).ToArray()
                );

            var response = new Server.DTO.ApiErrorResponse
            {
                StatusCode = StatusCodes.Status400BadRequest,
                Message = "Validation failed. Please check the submitted data.",
                Errors = errors,
                TraceId = context.HttpContext.TraceIdentifier
            };

            return new BadRequestObjectResult(response);
        };
    });
builder.Services.AddSingleton<TokenService>();

// UserStore needs to be scoped to access DbContext
builder.Services.AddScoped<UserStore>();
builder.Services.AddScoped<IMealPlanSuggester, MealPlanSuggester>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var key = builder.Configuration["Server:Key"];
        if (!string.IsNullOrWhiteSpace(key))
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Server:Issuer"],
                ValidAudience = builder.Configuration["Server:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                NameClaimType = System.Security.Claims.ClaimTypes.Name
            };
        }
    });

builder.Services.AddAuthorization();

// ================================================================
// ---------- Build ----------
// ================================================================

var app = builder.Build();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ---------- DB setup + seed data ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    ApplyMigrations(db, app.Environment);

    UserStore.SeedDefaults(db);
    UserStore.EnsureCommunityUsers(db);

    var seedOwnerUsernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "alice", "bob", "marco", "priya", "sam", "jordan", "nina", "liam", "sofia", "daniel", "mei"
    };
    var ownerPool = db.Users
        .Where(u => u.Role == "User" && seedOwnerUsernames.Contains(u.Username))
        .ToList();

    var seedRecipes = SeedRecipes.GetSeedRecipes();

    var index = 0;
    foreach (var recipe in seedRecipes)
    {
        var existingRecipe = db.Recipes.FirstOrDefault(r =>
            r.UserId == recipe.UserId &&
            r.Title == recipe.Title);

        if (existingRecipe == null)
        {
            RecipeSeedEnricher.Enrich(recipe, index, ownerPool);
            db.Recipes.Add(recipe);
        }
        else
        {
            existingRecipe.Ingredients = recipe.Ingredients;
            existingRecipe.Category = recipe.Category;
            existingRecipe.ImageUrl = ""; // Force refresh to use local images
            existingRecipe.DietRestriction = ""; // Force refresh
            existingRecipe.Allergens = ""; // Force refresh
            RecipeSeedEnricher.Enrich(existingRecipe, index, ownerPool);
        }
        index++;
    }

    db.SaveChanges();

    var currentMonday = WeekDateHelper.CurrentMonday();

    // One-time backfill: plans that inherited the migration default land on this week
    if (db.Database.CanConnect())
    {
        try
        {
            var legacyDefault = new DateOnly(2026, 7, 7);
            foreach (var plan in db.MealPlans.Where(p => p.WeekStartDate == legacyDefault))
                plan.WeekStartDate = currentMonday;
            db.SaveChanges();
        }
        catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.Message.Contains("WeekStartDate"))
        {
            // Column not migrated yet — skip backfill; Migrate() should have run above
            Console.WriteLine("Warning: WeekStartDate column missing; skipping meal-plan backfill.");
        }
    }

    if (!db.MealPlans.Any())
    {
        var recipes = db.Recipes.Where(r => r.UserId == 1).ToList();
        if (recipes.Count > 0)
        {
            var weekStart = WeekDateHelper.CurrentMonday();
            db.MealPlans.Add(new MealPlan
            {
                UserId = 1,
                WeekStartDate = weekStart,
                Day = "Monday",
                MealSlot = "dinner",
                RecipeId = recipes[0].Id
            });
            db.SaveChanges();
        }
    }

    if (!db.Pantries.Any())
    {
        db.Pantries.AddRange(
            new Pantry { UserId = 1, IngredientName = "Rice", Category = "Grains", Quantity = 2, Unit = "kg", ExpiryDate = DateTime.UtcNow.AddMonths(6) },
            new Pantry { UserId = 1, IngredientName = "Eggs", Category = "Proteins", Quantity = 10, Unit = "pieces", ExpiryDate = DateTime.UtcNow.AddDays(14) },
            new Pantry { UserId = 1, IngredientName = "Soy Sauce", Category = "Spices", Quantity = 1, Unit = "bottle", ExpiryDate = DateTime.UtcNow.AddYears(1) });
        db.SaveChanges();
    }

    var categorySeedList = new[]
    {
        new RecipeCategory { Name = "Veggie", Emoji = "🥦", ColorKey = "lime", SortOrder = 0 },
        new RecipeCategory { Name = "Breakfast", Emoji = "🍳", ColorKey = "yellow", SortOrder = 1 },
        new RecipeCategory { Name = "Dessert", Emoji = "🍰", ColorKey = "pink", SortOrder = 2 },
        new RecipeCategory { Name = "Thai", Emoji = "🍜", ColorKey = "red", SortOrder = 3 },
        new RecipeCategory { Name = "Grilled", Emoji = "🥩", ColorKey = "stone", SortOrder = 4 },
        new RecipeCategory { Name = "Pasta", Emoji = "🍝", ColorKey = "orange", SortOrder = 5 },
        new RecipeCategory { Name = "Soup", Emoji = "🍲", ColorKey = "blue", SortOrder = 6 },
        new RecipeCategory { Name = "Salad", Emoji = "🥬", ColorKey = "emerald", SortOrder = 7 },
        new RecipeCategory { Name = "Sandwich", Emoji = "🥪", ColorKey = "brown", SortOrder = 8 },
        new RecipeCategory { Name = "Curry", Emoji = "🍛", ColorKey = "purple", SortOrder = 9 },
        new RecipeCategory { Name = "Seafood", Emoji = "🦐", ColorKey = "cyan", SortOrder = 10 },
        new RecipeCategory { Name = "Mexican", Emoji = "🇲🇽", ColorKey = "rose", SortOrder = 11 },
        new RecipeCategory { Name = "Italian", Emoji = "🇮🇹", ColorKey = "violet", SortOrder = 12 },
        new RecipeCategory { Name = "Asian", Emoji = "🥡", ColorKey = "indigo", SortOrder = 13 },
        new RecipeCategory { Name = "Mediterranean", Emoji = "🫒", ColorKey = "teal", SortOrder = 14 },
        new RecipeCategory { Name = "Comfort Food", Emoji = "🍲", ColorKey = "warm", SortOrder = 15 },
        new RecipeCategory { Name = "Quick & Easy", Emoji = "⚡", ColorKey = "sky", SortOrder = 16 },
        new RecipeCategory { Name = "Healthy", Emoji = "💚", ColorKey = "mint", SortOrder = 17 },
        new RecipeCategory { Name = "Kids Friendly", Emoji = "👶", ColorKey = "baby", SortOrder = 18 }
    };

    var existingCategoryNames = db.RecipeCategories.Select(c => c.Name).ToHashSet();

    foreach (var category in categorySeedList)
    {
        if (!existingCategoryNames.Contains(category.Name))
        {
            db.RecipeCategories.Add(category);
        }
        else
        {
            var existing = db.RecipeCategories.FirstOrDefault(c => c.Name == category.Name);
            if (existing != null)
            {
                existing.Emoji = category.Emoji;
                existing.ColorKey = category.ColorKey;
                existing.SortOrder = category.SortOrder;
            }
        }
    }
    db.SaveChanges();

    RecipeCategoryAssigner.EnsureAssignments(db);
    RecipeCategoryAssigner.RemoveUnusedCategories(db, "Tacos", "Bowls");
}

// ---------- Vision chat client (for receipt image parsing) ----------

IChatClient? visionChat = null;
if (apiKey is not null)
{
    var visionOpts = new OpenAIClientOptions
    {
        Endpoint = new Uri("https://generativelanguage.googleapis.com/v1beta/openai/")
    };
    var visionAi = new OpenAIClient(new ApiKeyCredential(apiKey), visionOpts);
    visionChat = visionAi
        .GetChatClient("gemini-2.5-flash")
        .AsIChatClient();
}

// ---------- Helper: shared error handling for AI calls ----------

static IResult HandleAiError(Exception ex)
{
    if (ex is HttpOperationException httpEx && httpEx.StatusCode == HttpStatusCode.TooManyRequests)
    {
        return Results.Problem(
            detail: "The AI service is rate-limited right now — please wait a moment and try again.",
            statusCode: StatusCodes.Status429TooManyRequests);
    }

    if (ex is HttpOperationException unavailableEx && unavailableEx.StatusCode == HttpStatusCode.ServiceUnavailable)
    {
        return Results.Problem(
            detail: "The AI service is temporarily unavailable — please try again in a moment.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status500InternalServerError);
}

// Deterministic, non-AI comparison of one recipe's ingredient list against
// the user's pantry — used by both "what can I make" and "am I missing
// anything", so those features always reflect the same saved recipe data
// rather than the AI's guess at what a dish "typically" needs.
static (Recipe Recipe, double MatchRatio, List<string> Missing) AnalyseRecipeAgainstPantry(
    Recipe recipe, List<string> pantryNames)
{
    var ingredients = recipe.Ingredients
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(i => i.Length > 0)
        .ToList();

    if (ingredients.Count == 0) return (recipe, 0, new List<string>());

    var missing = ingredients
        .Where(ingredient => !pantryNames.Any(p =>
            ingredient.Contains(p, StringComparison.OrdinalIgnoreCase) ||
            p.Contains(ingredient, StringComparison.OrdinalIgnoreCase)))
        .ToList();

    var ratio = (double)(ingredients.Count - missing.Count) / ingredients.Count;
    return (recipe, ratio, missing);
}

// Extracts the first JSON object from a generated-recipe response (models
// sometimes wrap it in prose or markdown fences).
static GeneratedRecipe? ParseGeneratedRecipe(string content)
{
    var start = content.IndexOf('{');
    var end = content.LastIndexOf('}');
    if (start < 0 || end <= start) return null;

    try
    {
        var json = content.Substring(start, end - start + 1);
        return System.Text.Json.JsonSerializer.Deserialize<GeneratedRecipe>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }
    catch (System.Text.Json.JsonException)
    {
        return null;
    }
}

// ---------- Endpoints ----------

app.MapPost("/api/ai/assistant", async (ChatRequest req, Kernel kernel) =>
{
    if (string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { error = "Message cannot be empty." });

    try
    {
        // TODO: once JWT auth exists, replace this with the real authenticated user id
        int userId = 1;

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a friendly recipe and meal-planning assistant. " +
            $"The current user's id is {userId}. Use the RecipeData plugin " +
            $"functions to look up their recipes or meal plan before answering.");
        history.AddUserMessage(req.Message);

        var settings = new OpenAIPromptExecutionSettings
        {
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
        };

        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

app.MapPost("/api/ai/suggest-meal", async (Kernel kernel) =>
{
    try
    {
        int userId = 1; // TODO: replace with real authenticated user id later

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a meal-planning assistant. The current user's id is {userId}. " +
            $"Use the RecipeData plugin to look at their saved recipes, then suggest " +
            $"ONE good dinner option from those recipes with a one-sentence reason why.");
        history.AddUserMessage("Suggest a meal for me.");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

app.MapPost("/api/ai/summarize-recipes", async (Kernel kernel) =>
{
    try
    {
        int userId = 1; // TODO: replace with real authenticated user id later

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a recipe assistant. The current user's id is {userId}. " +
            $"Use the RecipeData plugin to fetch their saved recipes, then write a short, " +
            $"friendly summary of what kinds of meals they tend to save (cuisines, ingredients, patterns).");
        history.AddUserMessage("Summarize my saved recipes.");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

// ---------- Preferences ----------

app.MapGet("/api/ai/preferences/{userId:int}", async (int userId, AppDbContext db) =>
{
    var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);
    if (prefs == null)
        return Results.Ok(new { goal = "maintain", dietType = "none", allergies = "" });

    return Results.Ok(new { goal = prefs.Goal, dietType = prefs.DietType, allergies = prefs.Allergies });
});

app.MapPost("/api/ai/preferences", async (SavePreferencesRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Goal) || string.IsNullOrWhiteSpace(req.DietType))
        return Results.BadRequest(new { error = "Goal and diet type are required." });

    var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == req.UserId);
    if (prefs == null)
    {
        prefs = new UserPreference { UserId = req.UserId };
        db.UserPreferences.Add(prefs);
    }

    prefs.Goal = req.Goal;
    prefs.DietType = req.DietType;
    prefs.Allergies = req.Allergies ?? "";

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Preferences saved." });
});

// ---------- Weekly Plan Generation ----------

// Builds the week from ONLY the user's saved recipes, pre-filtered by their
// stored allergies and diet type. The AI (when configured) is asked to pick a
// tasty, varied arrangement of those already-allowed recipes; AutoPlanBuilder
// then validates/repairs the result deterministically, so an invented recipe
// or an off-diet/allergen recipe can never reach the reply — with or without
// the AI available.
app.MapPost("/api/ai/weekly-plan", async (AppDbContext db, IMealPlanSuggester suggester) =>
{
    int userId = 1; // TODO: replace with real authenticated user id later

    try
    {
        var recipes = await db.Recipes.Where(r => r.UserId == userId).ToListAsync();
        if (recipes.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "You don't have any saved recipes yet — add a few recipes first and I'll build your weekly plan from them."
            });
        }

        var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        var allowedRecipes = AutoPlanBuilder.FilterByDietType(
            AutoPlanBuilder.FilterAllergens(recipes, prefs), prefs);

        if (allowedRecipes.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "None of your saved recipes fit your current diet type and allergies, so I can't build a plan. " +
                        "Try saving some recipes that match your preferences, or update them above."
            });
        }

        var aiSuggestions = await suggester.SuggestWeekAsync(allowedRecipes, prefs);
        var week = AutoPlanBuilder.BuildWeek(allowedRecipes, prefs, aiSuggestions);

        var recipeById = allowedRecipes.ToDictionary(r => r.Id);
        var sb = new StringBuilder();
        sb.AppendLine(
            $"Here's your weekly meal plan, built only from your saved recipes " +
            $"(goal: {prefs?.Goal ?? "maintain"}, diet: {prefs?.DietType ?? "none"}" +
            $"{(string.IsNullOrWhiteSpace(prefs?.Allergies) ? "" : $", avoiding: {prefs!.Allergies}")}). " +
            $"If this looks good, hit \"Save this plan\" and it'll be added to your meal planner.");
        sb.AppendLine();

        foreach (var day in AutoPlanBuilder.Days)
        {
            sb.AppendLine($"**{day}**");
            foreach (var slot in AutoPlanBuilder.Slots)
            {
                var entry = week.First(w => w.Day == day && w.MealSlot == slot);
                var title = recipeById[entry.RecipeId].Title;
                sb.AppendLine($"- {char.ToUpper(slot[0])}{slot[1..]}: {title}");
            }
            sb.AppendLine();
        }

        // Structured form of the exact same plan, so the client can send it
        // straight to /api/mealplans/{userId}/apply-plan once the user
        // confirms — no re-generation, no risk of saving something different
        // from what was just previewed.
        var planForClient = week.Select(w => new
        {
            day = w.Day,
            mealSlot = w.MealSlot,
            recipeId = w.RecipeId,
            recipeTitle = recipeById[w.RecipeId].Title
        }).ToList();

        return Results.Ok(new { reply = sb.ToString().TrimEnd(), plan = planForClient });
    }
    catch (Microsoft.SemanticKernel.HttpOperationException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
    {
        return Results.Problem(detail: "The AI service is rate-limited right now — please wait a moment and try again.", statusCode: 429);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// ---------- AI: What can I make with my pantry? ----------
// Deterministic and grounded in the user's own saved recipes: no invented
// dishes, ever. Ranks saved recipes (after allergy/diet filtering) by how
// much of each recipe's ingredient list is already in the pantry.

app.MapPost("/api/ai/what-can-i-make", async (AppDbContext db) =>
{
    try
    {
        int userId = 1; // TODO: replace with real user id

        var recipes = await db.Recipes.Where(r => r.UserId == userId).ToListAsync();
        if (recipes.Count == 0)
            return Results.Ok(new { reply = "You don't have any saved recipes yet — add a few and I'll tell you what you can make." });

        var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);
        var allowedRecipes = AutoPlanBuilder.FilterByDietType(AutoPlanBuilder.FilterAllergens(recipes, prefs), prefs);

        var pantryNames = await db.Pantries.Where(p => p.UserId == userId).Select(p => p.IngredientName).ToListAsync();
        if (pantryNames.Count == 0)
            return Results.Ok(new { reply = "Your pantry is empty — add some ingredients and I'll tell you what you can make." });

        var ranked = allowedRecipes
            .Select(r => AnalyseRecipeAgainstPantry(r, pantryNames))
            .OrderByDescending(x => x.MatchRatio)
            .ThenBy(x => x.Missing.Count)
            .Take(3)
            .ToList();

        var readyNow = ranked.Where(x => x.Missing.Count == 0).ToList();
        var sb = new StringBuilder();

        if (readyNow.Count > 0)
        {
            sb.AppendLine("You can make these right now from your saved recipes:");
            foreach (var r in readyNow) sb.AppendLine($"- {r.Recipe.Title}");
        }
        else
        {
            sb.AppendLine("Nothing in your saved recipes is fully covered by your pantry yet — your closest matches are:");
            foreach (var r in ranked)
                sb.AppendLine($"- {r.Recipe.Title}: missing {string.Join(", ", r.Missing)}");
        }

        return Results.Ok(new { reply = sb.ToString().TrimEnd() });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

// ---------- AI: Am I missing any ingredients for a specific saved recipe? ----------
// Takes a recipeId (picked from a grid of the user's own recipes on the
// client, not typed free-text) so this always checks their actual saved
// ingredient list rather than the AI's guess at a generic dish.

app.MapPost("/api/ai/missing-ingredients", async (MealCheckRequest req, AppDbContext db) =>
{
    if (req.RecipeId <= 0)
        return Results.BadRequest(new { error = "Please pick one of your saved recipes." });

    try
    {
        int userId = 1; // TODO: replace with real user id

        var recipe = await db.Recipes.FirstOrDefaultAsync(r => r.Id == req.RecipeId && r.UserId == userId);
        if (recipe == null)
            return Results.BadRequest(new { error = "Recipe not found." });

        var pantryNames = await db.Pantries.Where(p => p.UserId == userId).Select(p => p.IngredientName).ToListAsync();
        var (_, _, missing) = AnalyseRecipeAgainstPantry(recipe, pantryNames);

        var allIngredients = recipe.Ingredients
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
        var have = allIngredients.Except(missing, StringComparer.OrdinalIgnoreCase).ToList();

        var sb = new StringBuilder();
        sb.AppendLine($"**{recipe.Title}**");
        sb.AppendLine();
        sb.AppendLine("✅ Ingredients you have:");
        sb.AppendLine(have.Count > 0 ? string.Join("\n", have.Select(i => $"- {i}")) : "- (none yet)");
        sb.AppendLine();
        sb.AppendLine("❌ Ingredients you still need to buy:");
        sb.AppendLine(missing.Count > 0 ? string.Join("\n", missing.Select(i => $"- {i}")) : "- (none — you have it all!)");
        sb.AppendLine();
        sb.AppendLine(missing.Count == 0
            ? "You can make this now! 🎉"
            : $"You're missing {missing.Count} ingredient(s) — grab those and you're set.");

        return Results.Ok(new { reply = sb.ToString().TrimEnd() });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

// ---------- AI: Generate a brand-new recipe idea ----------
// The one deliberate exception to "existing recipes only" — this is the
// shortcut for when the user wants something new. NEVER used to answer
// "what can I make" or the weekly plan; those stay grounded in saved recipes.

app.MapPost("/api/ai/generate-recipe", async (GenerateRecipeRequest req, Kernel kernel) =>
{
    try
    {
        int userId = 1; // TODO: replace with real user id

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a creative cooking assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their goal, diet type, and allergies. " +
            $"NEVER include any ingredient matching their listed allergies, even partially, and " +
            $"respect their diet type (e.g. no meat for vegetarian, no meat/dairy/egg for vegan, " +
            $"no pork/alcohol for halal). Invent ONE brand-new recipe" +
            (string.IsNullOrWhiteSpace(req.Craving) ? "." : $" involving: {req.Craving}.") +
            " Respond with ONLY a JSON object, no prose, no markdown fences, in the form: " +
            "{\"title\":\"...\",\"category\":\"Breakfast|Veggie|Dessert|Thai|Grilled|Pasta|Soup|Salad|Sandwich|Curry|Seafood|Mexican|Italian|Asian|Mediterranean|Comfort Food|Quick & Easy|Healthy|Kids Friendly\"," +
            "\"ingredients\":\"comma, separated, list\",\"instructions\":\"numbered steps as one string\"," +
            "\"dietRestriction\":\"none|vegetarian|vegan|gluten-free|dairy-free|nut-free|low-carb|paleo|low-sodium|sugar-free|whole30|mediterranean|pescatarian\"," +
            "\"allergens\":\"comma, separated, allergens, or, empty, string\"," +
            "\"imageUrl\":\"\"}");
        history.AddUserMessage(string.IsNullOrWhiteSpace(req.Craving)
            ? "Surprise me with a new recipe."
            : $"Come up with a new recipe using {req.Craving}.");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);

        var parsed = ParseGeneratedRecipe(result.Content ?? "");
        if (parsed == null)
        {
            return Results.Ok(new
            {
                reply = result.Content ?? "Sorry, I couldn't come up with a recipe that time — try again.",
                recipe = (object?)null
            });
        }

        var reply = $"**{parsed.Title}** ({parsed.Category})\n\n" +
            $"Diet: {parsed.DietRestriction}\n" +
            (string.IsNullOrWhiteSpace(parsed.Allergens) ? "" : $"Allergens: {parsed.Allergens}\n\n") +
            $"Ingredients: {parsed.Ingredients}\n\nInstructions:\n{parsed.Instructions}";
        return Results.Ok(new { reply, recipe = parsed });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

// ---------- Save a generated (or manually written) recipe ----------

app.MapPost("/api/recipes", async (SaveRecipeRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Ingredients))
        return Results.BadRequest(new { error = "Title and ingredients are required." });

    int userId = 1; // TODO: replace with real user id

    var recipe = new Recipe
    {
        UserId = userId,
        Title = req.Title.Trim(),
        Ingredients = req.Ingredients.Trim(),
        Steps = string.IsNullOrWhiteSpace(req.Steps) ? "" : req.Steps.Trim(),
        Category = string.IsNullOrWhiteSpace(req.Category) ? "Uncategorized" : req.Category.Trim(),
        ImageUrl = string.IsNullOrWhiteSpace(req.ImageUrl) ? "" : req.ImageUrl.Trim(),
        OwnerName = string.IsNullOrWhiteSpace(req.OwnerName) ? "AI-Generated" : req.OwnerName.Trim(),
        DietRestriction = string.IsNullOrWhiteSpace(req.DietRestriction) ? "none" : req.DietRestriction.Trim(),
        Allergens = string.IsNullOrWhiteSpace(req.Allergens) ? "" : req.Allergens.Trim()
    };

    db.Recipes.Add(recipe);
    await db.SaveChangesAsync();

    // Handle category assignments
    if (req.CategoryIds != null && req.CategoryIds.Length > 0)
    {
        foreach (var categoryIdStr in req.CategoryIds)
        {
            if (int.TryParse(categoryIdStr, out var categoryId))
            {
                var categoryExists = await db.RecipeCategories.AnyAsync(c => c.Id == categoryId);
                if (categoryExists)
                {
                    db.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment
                    {
                        RecipeId = recipe.Id,
                        RecipeCategoryId = categoryId
                    });
                }
            }
        }
        await db.SaveChangesAsync();
    }
    else if (!string.IsNullOrWhiteSpace(recipe.Category))
    {
        var categoryId = await db.RecipeCategories
            .Where(c => c.Name == recipe.Category)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();

        if (categoryId.HasValue)
        {
            db.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment
            {
                RecipeId = recipe.Id,
                RecipeCategoryId = categoryId.Value
            });
            await db.SaveChangesAsync();
        }
    }

    return Results.Ok(new { recipe.Id, recipe.Title, recipe.Category, recipe.ImageUrl });
});

// ---------- Dashboard Endpoints ----------

app.MapGet("/api/dashboard/stats/{userId:int}", async (int userId, AppDbContext db) =>
{
    var totalRecipes = await db.Recipes.CountAsync(r => r.UserId == userId);
    var totalMealPlans = await db.MealPlans.CountAsync(m => m.UserId == userId);

    return Results.Ok(new
    {
        totalRecipes,
        totalMealPlans
    });
});

app.MapGet("/api/dashboard/recent-recipes/{userId:int}", async (int userId, AppDbContext db) =>
{
    var recentRecipes = await db.Recipes
        .Where(r => r.UserId == userId)
        .OrderByDescending(r => r.Id)
        .Take(6)
        .Select(r => new { r.Id, r.Title, r.Category, r.Ingredients, r.ImageUrl, r.OwnerName, r.DietRestriction })
        .ToListAsync();

    // Load category assignments for each recipe
    var recipeIds = recentRecipes.Select(r => r.Id).ToList();
    var categoryAssignments = await db.RecipeCategoryAssignments
        .Where(rca => recipeIds.Contains(rca.RecipeId))
        .Include(rca => rca.RecipeCategory)
        .ToListAsync();

    var result = recentRecipes.Select(r => new
    {
        r.Id,
        r.Title,
        r.Category,
        r.Ingredients,
        r.ImageUrl,
        r.OwnerName,
        r.DietRestriction,
        Categories = categoryAssignments
            .Where(ca => ca.RecipeId == r.Id)
            .Select(ca => new { ca.RecipeCategory.Id, ca.RecipeCategory.Name, ca.RecipeCategory.Emoji, ca.RecipeCategory.ColorKey })
            .ToList()
    }).ToList();

    return Results.Ok(result);
});

app.MapGet("/api/dashboard/weekly-summary/{userId:int}", async (int userId, AppDbContext db) =>
{
    var weeklyPlans = await db.MealPlans
        .Where(m => m.UserId == userId)
        .Include(m => m.Recipe)
        .OrderBy(m => m.Day)
        .ThenBy(m => m.MealSlot)
        .ToListAsync();

    var mealsByDay = weeklyPlans
        .GroupBy(m => m.Day)
        .Select(g => new
        {
            Day = g.Key,
            Meals = g.Select(m => new { m.MealSlot, RecipeTitle = m.Recipe.Title })
        })
        .ToList();

    return Results.Ok(mealsByDay);
});

// "Top Recipe Categories" tiles shown on the user dashboard.
// Fully managed by admins via AdminController (create/edit/remove).
app.MapGet("/api/dashboard/categories", async (AppDbContext db) =>
{
    var categories = await db.RecipeCategories
        .OrderBy(c => c.Name)
        .Select(c => new { c.Id, c.Name, c.Emoji, c.ColorKey })
        .ToListAsync();

    return Results.Ok(categories);
});

// ---------- Pantry Endpoints ----------

app.MapGet("/api/pantry/{userId:int}", async (int userId, AppDbContext db) =>
{
    var pantryItems = await db.Pantries
        .Where(p => p.UserId == userId)
        .OrderBy(p => p.Category)
        .ThenBy(p => p.IngredientName)
        .ToListAsync();

    return Results.Ok(pantryItems);
});

app.MapPost("/api/pantry", async (PantryRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.IngredientName) || string.IsNullOrWhiteSpace(req.Category))
        return Results.BadRequest(new { error = "Ingredient name and category are required." });

    var pantryItem = new Pantry
    {
        UserId = req.UserId,
        IngredientName = req.IngredientName,
        Category = req.Category,
        Quantity = req.Quantity > 0 ? req.Quantity : 1,
        Unit = req.Unit ?? "",
        ExpiryDate = req.ExpiryDate
    };

    db.Pantries.Add(pantryItem);
    await db.SaveChangesAsync();

    return Results.Ok(pantryItem);
});

app.MapPut("/api/pantry/{id:int}", async (int id, PantryRequest req, AppDbContext db) =>
{
    var pantryItem = await db.Pantries.FindAsync(id);
    if (pantryItem == null)
        return Results.NotFound();

    if (string.IsNullOrWhiteSpace(req.IngredientName) || string.IsNullOrWhiteSpace(req.Category))
        return Results.BadRequest(new { error = "Ingredient name and category are required." });

    pantryItem.IngredientName = req.IngredientName;
    pantryItem.Category = req.Category;
    pantryItem.Quantity = req.Quantity > 0 ? req.Quantity : 1;
    pantryItem.Unit = req.Unit ?? "";
    pantryItem.ExpiryDate = req.ExpiryDate;

    await db.SaveChangesAsync();

    return Results.Ok(pantryItem);
});

app.MapDelete("/api/pantry/{id:int}", async (int id, AppDbContext db) =>
{
    var pantryItem = await db.Pantries.FindAsync(id);
    if (pantryItem == null)
        return Results.NotFound();

    db.Pantries.Remove(pantryItem);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Item deleted successfully." });
});

// ---------- Receipt Parser (scan grocery receipt → extract items → add to pantry) ----------

app.MapPost("/api/receipt/parse", async (HttpRequest req) =>
{
    if (visionChat is null)
        return Results.Problem(detail: "AI belum dikonfigurasi (GoogleAI:ApiKey kosong).", statusCode: 503);

    var form = await req.ReadFormAsync();
    var file = form.Files["image"];

    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "No image uploaded." });

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);
    var image = new DataContent(ms.ToArray(), file.ContentType ?? "image/jpeg");

    const string prompt =
        "Read this grocery receipt. Extract every grocery item purchased. " +
        "For each item return its name, a numeric quantity if shown (e.g. '2', '500'; " +
        "default to '1' if not shown), and a unit of measurement (e.g. 'g', 'kg', 'ml', " +
        "'l', 'piece', 'bottle', 'can', 'bag', 'loaf'; use 'piece' if no unit is printed " +
        "and it's a countable item). " +
        "Ignore prices, totals, tax, store name, and dates — only the grocery items matter. " +
        "Return as a JSON array like: [{\"name\":\"chicken breast\",\"quantity\":\"500\",\"unit\":\"g\"}, ...]";

    var message = new ChatMessage(ChatRole.User, [new Microsoft.Extensions.AI.TextContent(prompt), image]);

    try
    {
        var result = await visionChat.GetResponseAsync<List<ParsedItem>>([message]);
        return Results.Ok(result.Result ?? new List<ParsedItem>());
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// ---------- Object Detection (photo of fridge/pantry shelf -> detected food items) ----------

app.MapPost("/api/detect", async (HttpRequest req) =>
{
    if (visionChat is null)
        return Results.Problem(detail: "AI belum dikonfigurasi (GoogleAI:ApiKey kosong).", statusCode: 503);

    var form = await req.ReadFormAsync();
    var file = form.Files["image"];

    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "No image uploaded." });

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);
    var image = new DataContent(ms.ToArray(), file.ContentType ?? "image/jpeg");

    const string detectPrompt =
        "Detect every prominent food or grocery item in this image. " +
        "For each object return a short label, a confidence " +
        "between 0 and 1, a tight bounding box as yMin, " +
        "xMin, yMax, xMax normalised to a 0-1000 scale, and a typical unit " +
        "of measurement for that item (e.g. 'piece', 'bottle', 'carton', 'loaf', " +
        "'can', 'bag', 'kg' — pick whichever is most natural for how that item is " +
        "normally counted or measured). " +
        "Also write a one-sentence summary of the scene. " +
        "If no objects are found, return an empty list.";

    var message = new ChatMessage(ChatRole.User, [new Microsoft.Extensions.AI.TextContent(detectPrompt), image]);

    try
    {
        var result = await visionChat.GetResponseAsync<DetectionResult>([message]);
        return Results.Ok(result.Result);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

// Bulk-add parsed receipt/detection items into the Pantry table.
// Items are first merged by name *within this batch* (so e.g. two "tomato"
// detections in one photo become one entry with Quantity 2, instead of two
// separate rows) before checking against existing pantry rows.
// A purely numeric quantity (e.g. "2") is treated as a count and summed;
// anything else (e.g. "500g", "1 bottle") is treated as a descriptive unit,
// and counts as a single occurrence of that item.
app.MapPost("/api/pantry/bulk-add", async (List<ParsedItem> items, AppDbContext db) =>
{
    int userId = 1; // TODO: replace with real authenticated user id later

    if (items == null || items.Count == 0)
        return Results.BadRequest(new { error = "No items provided." });

    var grouped = new Dictionary<string, (string DisplayName, int Count, string? Unit)>(StringComparer.OrdinalIgnoreCase);

    foreach (var item in items)
    {
        if (string.IsNullOrWhiteSpace(item.Name)) continue;

        var name = item.Name.Trim();
        var key = name.ToLowerInvariant();

        int count = 1;
        string? unit = null;

        if (!string.IsNullOrWhiteSpace(item.Unit))
        {
            // New-style: quantity is a real number, unit is separate.
            unit = item.Unit.Trim();
            if (int.TryParse(item.Quantity?.Trim(), out var parsedCount) && parsedCount > 0)
                count = parsedCount;
        }
        else if (!string.IsNullOrWhiteSpace(item.Quantity))
        {
            // Legacy fallback: quantity text alone, e.g. "500g" or "2".
            var qtyText = item.Quantity.Trim();
            if (int.TryParse(qtyText, out var parsedCount) && parsedCount > 0)
                count = parsedCount;
            else
                unit = qtyText;
        }

        if (grouped.TryGetValue(key, out var existingGroup))
        {
            grouped[key] = (
                existingGroup.DisplayName,
                existingGroup.Count + count,
                unit ?? existingGroup.Unit
            );
        }
        else
        {
            grouped[key] = (name, count, unit);
        }
    }

    foreach (var group in grouped.Values)
    {
        var existing = await db.Pantries.FirstOrDefaultAsync(p =>
            p.UserId == userId && p.IngredientName.ToLower() == group.DisplayName.ToLower());

        if (existing != null)
        {
            existing.Quantity += group.Count;
            if (!string.IsNullOrWhiteSpace(group.Unit))
                existing.Unit = group.Unit;
        }
        else
        {
            db.Pantries.Add(new Pantry
            {
                UserId = userId,
                IngredientName = group.DisplayName,
                Category = "Uncategorized",
                Quantity = group.Count,
                Unit = group.Unit ?? "",
                ExpiryDate = DateTime.Now.AddDays(14) // rough default; adjust per item type if desired
            });
        }
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { message = $"{items.Count} item(s) added to pantry." });
});

// ---------- Profile/Chart Endpoints ----------

app.MapGet("/api/profile/meal-stats/{userId:int}", async (int userId, AppDbContext db) =>
{
    var mealsByDay = await db.MealPlans
        .Where(m => m.UserId == userId)
        .GroupBy(m => m.Day)
        .Select(g => new
        {
            Day = g.Key,
            Count = g.Count()
        })
        .ToListAsync();

    return Results.Ok(mealsByDay);
});

app.MapGet("/api/profile/recent-activity/{userId:int}", async (int userId, AppDbContext db) =>
{
    var recentRecipes = await db.Recipes
        .Where(r => r.UserId == userId)
        .OrderByDescending(r => r.Id)
        .Take(5)
        .Select(r => new
        {
            Type = "Recipe",
            Title = r.Title,
            Timestamp = DateTime.Now.AddDays(-r.Id) // Simulated timestamp
        })
        .ToListAsync();

    var recentMealPlans = await db.MealPlans
        .Where(m => m.UserId == userId)
        .OrderByDescending(m => m.Id)
        .Take(3)
        .Select(m => new
        {
            Type = "Meal Plan",
            Title = $"{m.Day} - {m.MealSlot}",
            Timestamp = DateTime.Now.AddDays(-m.Id) // Simulated timestamp
        })
        .ToListAsync();

    var allActivity = recentRecipes.Concat(recentMealPlans)
        .OrderByDescending(a => a.Timestamp)
        .ToList();

    return Results.Ok(allActivity);
});

app.Run("http://localhost:5237");

static void ApplyMigrations(AppDbContext db, IHostEnvironment env)
{
    try
    {
        db.Database.Migrate();
        EnsureWeekStartDateColumn(db);
        EnsureRecipeOwnerColumns(db);
    }
    catch (Exception ex) when (env.IsDevelopment() && IsExistingTableConflict(ex))
    {
        Console.WriteLine();
        Console.WriteLine("=== Database reset (development only) ===");
        Console.WriteLine("The local SQLite file was created by an older setup and conflicts with EF migrations.");
        Console.WriteLine("Deleting ai_assistant_dev.db and creating a fresh database...");
        Console.WriteLine("(Registered accounts in the old file will be lost — re-register or use seeded users.)");
        Console.WriteLine();
        db.Database.EnsureDeleted();
        db.Database.Migrate();
        EnsureWeekStartDateColumn(db);
        EnsureRecipeOwnerColumns(db);
    }
}

// The AddMealPlanWeekStartDate migration was once generated with an empty Up()
// body on some machines, so the history row can exist without the column.
static void EnsureWeekStartDateColumn(AppDbContext db)
{
    var connection = db.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
        connection.Open();

    using var info = connection.CreateCommand();
    info.CommandText = "PRAGMA table_info(MealPlans);";
    using var reader = info.ExecuteReader();
    var hasColumn = false;
    while (reader.Read())
    {
        if (string.Equals(reader.GetString(1), "WeekStartDate", StringComparison.OrdinalIgnoreCase))
        {
            hasColumn = true;
            break;
        }
    }

    if (!hasColumn)
    {
        Console.WriteLine("Applying missing WeekStartDate column on MealPlans...");
        db.Database.ExecuteSqlRaw(
            "ALTER TABLE MealPlans ADD COLUMN WeekStartDate TEXT NOT NULL DEFAULT '2026-07-07';");
    }
}

static void EnsureRecipeOwnerColumns(AppDbContext db)
{
    var connection = db.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
        connection.Open();

    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using (var info = connection.CreateCommand())
    {
        info.CommandText = "PRAGMA table_info(Recipes);";
        using var reader = info.ExecuteReader();
        while (reader.Read())
            columns.Add(reader.GetString(1));
    }

    if (!columns.Contains("OwnerName"))
    {
        Console.WriteLine("Applying missing OwnerName column on Recipes...");
        db.Database.ExecuteSqlRaw("ALTER TABLE Recipes ADD COLUMN OwnerName TEXT NOT NULL DEFAULT '';");

        if (columns.Contains("OwnerUsername"))
        {
            db.Database.ExecuteSqlRaw("""
                UPDATE Recipes
                SET OwnerName = COALESCE(
                    (SELECT FullName FROM Users WHERE lower(Users.Username) = lower(Recipes.OwnerUsername)),
                    OwnerUsername
                );
                """);
        }
    }

    if (!columns.Contains("DietRestriction"))
    {
        Console.WriteLine("Applying missing DietRestriction column on Recipes...");
        db.Database.ExecuteSqlRaw("ALTER TABLE Recipes ADD COLUMN DietRestriction TEXT NOT NULL DEFAULT 'none';");
    }
}

static bool IsExistingTableConflict(Exception ex)
{
    for (var current = ex; current is not null; current = current.InnerException)
    {
        if (current.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
            return true;
    }
    return false;
}

// ---------- Records ----------

record ChatRequest(string Message);
record SavePreferencesRequest(int UserId, string Goal, string DietType, string Allergies);
record PantryRequest(int UserId, string IngredientName, string Category, int Quantity, string Unit, DateTime ExpiryDate);
record ParsedItem(string Name, string? Quantity, string? Unit);
record MealCheckRequest(int RecipeId);
record DetectedObject(string Label, double Confidence, int YMin, int XMin, int YMax, int XMax, string? Unit);
record DetectionResult(List<DetectedObject> Objects, string Summary);
record GenerateRecipeRequest(string? Craving);
record GeneratedRecipe(string Title, string Category, string Ingredients, string Instructions, string DietRestriction, string Allergens, string ImageUrl);
record SaveRecipeRequest(string Title, string Ingredients, string? Steps, string? Category, string? ImageUrl, string? OwnerName, string? DietRestriction, string? Allergens, string[]? CategoryIds);
