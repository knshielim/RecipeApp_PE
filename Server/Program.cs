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
using Server.DTO;
using System.Security.Claims;

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
app.UseStaticFiles(); // serves uploaded recipe images from wwwroot

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

static IResult ApiError(HttpContext http, int statusCode, string message)
{
    return Results.Json(new ApiErrorResponse
    {
        StatusCode = statusCode,
        Message = message,
        TraceId = http.TraceIdentifier
    }, statusCode: statusCode);
}

static IResult HandleAiError(Exception ex, HttpContext http)
{
    if (ex is HttpOperationException httpEx &&
        httpEx.StatusCode == HttpStatusCode.TooManyRequests)
    {
        return ApiError(
            http,
            StatusCodes.Status429TooManyRequests,
            "The AI service is busy right now. Please wait a moment and try again.");
    }

    if (ex is HttpOperationException unavailableEx &&
        unavailableEx.StatusCode == HttpStatusCode.ServiceUnavailable)
    {
        return ApiError(
            http,
            StatusCodes.Status503ServiceUnavailable,
            "The AI service is temporarily unavailable. Please try again in a moment.");
    }

    return ApiError(
        http,
        StatusCodes.Status500InternalServerError,
        "Something went wrong while processing the AI request. Please try again later.");
}

static IResult? ValidateUserId(HttpContext http, int userId)
{
    if (userId <= 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "User ID must be valid.");
    }

    return null;
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

static async Task<User?> GetCurrentUserAsync(AppDbContext db, HttpContext http)
{
    var username =
        http.User.FindFirst(ClaimTypes.Name)?.Value ??
        http.User.FindFirst("username")?.Value ??
        http.User.FindFirst("unique_name")?.Value ??
        http.User.Identity?.Name;

    if (string.IsNullOrWhiteSpace(username))
        return null;

    return await db.Users.FirstOrDefaultAsync(u => u.Username == username);
}

// ---------- Endpoints ----------

app.MapPost("/api/ai/assistant", async (ChatRequest? req, Kernel kernel, HttpContext http) =>
{
    if (req == null || string.IsNullOrWhiteSpace(req.Message))
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Message cannot be empty.");
    }

    try
    {
        int userId = 1;

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();

        history.AddSystemMessage(
            $"You are a friendly recipe and meal-planning assistant. " +
            $"The current user's id is {userId}. Use the RecipeData plugin " +
            $"functions to look up their recipes or meal plan before answering.");

        history.AddUserMessage(req.Message.Trim());

        var settings = new OpenAIPromptExecutionSettings
        {
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
        };

        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);

        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

app.MapPost("/api/ai/suggest-meal", async (Kernel kernel, HttpContext http) =>
{
    try
    {
        int userId = 1;

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();

        history.AddSystemMessage(
            $"You are a meal-planning assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their goal, diet type, and allergies. " +
            $"Then use the RecipeData plugin to look at their saved recipes. " +
            $"Suggest ONE good dinner option from those recipes that matches their diet type and avoids their allergies. " +
            $"Include a one-sentence reason why it's a good match for their preferences.");

        history.AddUserMessage("Suggest a meal for me.");

        var settings = new OpenAIPromptExecutionSettings
        {
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
        };

        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);

        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

app.MapPost("/api/ai/summarize-recipes", async (Kernel kernel, HttpContext http) =>
{
    try
    {
        int userId = 1;

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();

        history.AddSystemMessage(
            $"You are a recipe assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their goal, diet type, and allergies. " +
            $"Then use the RecipeData plugin to fetch their saved recipes. " +
            $"Write a short, friendly summary of what kinds of meals they tend to save, " +
            $"and mention how their saved recipes align with their dietary preferences.");

        history.AddUserMessage("Summarize my saved recipes.");

        var settings = new OpenAIPromptExecutionSettings
        {
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
        };

        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);

        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- Preferences ----------

app.MapGet("/api/ai/preferences/{userId:int}", async (int userId, AppDbContext db, HttpContext http) =>
{
    var userIdError = ValidateUserId(http, userId);
    if (userIdError != null)
    {
        return userIdError;
    }

    var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

    if (prefs == null)
    {
        return Results.Ok(new
        {
            goal = "maintain",
            dietType = "none",
            allergies = ""
        });
    }

    return Results.Ok(new
    {
        goal = prefs.Goal,
        dietType = prefs.DietType,
        allergies = prefs.Allergies
    });
});

app.MapPost("/api/ai/preferences", async (SavePreferencesRequest? req, AppDbContext db, HttpContext http) =>
{
    if (req == null)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Preference data is required.");
    }

    if (req.UserId <= 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "User ID must be valid.");
    }

    if (string.IsNullOrWhiteSpace(req.Goal))
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Goal is required.");
    }

    if (string.IsNullOrWhiteSpace(req.DietType))
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Diet type is required.");
    }

    var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == req.UserId);

    if (prefs == null)
    {
        prefs = new UserPreference { UserId = req.UserId };
        db.UserPreferences.Add(prefs);
    }

    prefs.Goal = req.Goal.Trim();
    prefs.DietType = req.DietType.Trim();
    prefs.Allergies = req.Allergies?.Trim() ?? "";

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

app.MapPost("/api/ai/weekly-plan", async (AppDbContext db, IMealPlanSuggester suggester, HttpContext http) =>
{
    int userId = 1;

    try
    {
        var recipes = await db.Recipes
            .Where(r => r.UserId == userId)
            .ToListAsync();

        if (recipes.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "You don't have any saved recipes yet. Add a few recipes first and I'll build your weekly plan from them."
            });
        }

        var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        var allowedRecipes = AutoPlanBuilder.FilterByDietType(
            AutoPlanBuilder.FilterAllergens(recipes, prefs),
            prefs);

        if (allowedRecipes.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "None of your saved recipes fit your current diet type and allergies. Try saving recipes that match your preferences or update your preferences."
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

        var planForClient = week.Select(w => new
        {
            day = w.Day,
            mealSlot = w.MealSlot,
            recipeId = w.RecipeId,
            recipeTitle = recipeById[w.RecipeId].Title
        }).ToList();

        return Results.Ok(new
        {
            reply = sb.ToString().TrimEnd(),
            plan = planForClient
        });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- AI: What can I make with my pantry? ----------
// Deterministic and grounded in the user's own saved recipes: no invented
// dishes, ever. Ranks saved recipes (after allergy/diet filtering) by how
// much of each recipe's ingredient list is already in the pantry.

app.MapPost("/api/ai/what-can-i-make", async (AppDbContext db, HttpContext http) =>
{
    try
    {
        int userId = 1;

        var recipes = await db.Recipes
            .Where(r => r.UserId == userId)
            .ToListAsync();

        if (recipes.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "You don't have any saved recipes yet. Add a few and I'll tell you what you can make."
            });
        }

        var prefs = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);

        var allowedRecipes = AutoPlanBuilder.FilterByDietType(
            AutoPlanBuilder.FilterAllergens(recipes, prefs),
            prefs);

        var pantryNames = await db.Pantries
            .Where(p => p.UserId == userId)
            .Select(p => p.IngredientName)
            .ToListAsync();

        if (pantryNames.Count == 0)
        {
            return Results.Ok(new
            {
                reply = "Your pantry is empty. Add some ingredients and I'll tell you what you can make."
            });
        }

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

            foreach (var r in readyNow)
            {
                sb.AppendLine($"- {r.Recipe.Title}");
            }
        }
        else
        {
            sb.AppendLine("Nothing in your saved recipes is fully covered by your pantry yet. Your closest matches are:");

            foreach (var r in ranked)
            {
                sb.AppendLine($"- {r.Recipe.Title}: missing {string.Join(", ", r.Missing)}");
            }
        }

        return Results.Ok(new { reply = sb.ToString().TrimEnd() });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- AI: Am I missing any ingredients for a specific saved recipe? ----------
// Takes a recipeId (picked from a grid of the user's own recipes on the
// client, not typed free-text) so this always checks their actual saved
// ingredient list rather than the AI's guess at a generic dish.

app.MapPost("/api/ai/missing-ingredients", async (MealCheckRequest? req, AppDbContext db, HttpContext http) =>
{
    if (req == null || req.RecipeId <= 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Please pick one of your saved recipes.");
    }

    try
    {
        int userId = 1; // TODO: replace with real user id

        var recipe = await db.Recipes
            .FirstOrDefaultAsync(r => r.Id == req.RecipeId && r.UserId == userId);

        if (recipe == null)
        {
            return ApiError(
                http,
                StatusCodes.Status404NotFound,
                "Recipe not found.");
        }

        var pantryNames = await db.Pantries
            .Where(p => p.UserId == userId)
            .Select(p => p.IngredientName)
            .ToListAsync();

        var (_, _, missing) = AnalyseRecipeAgainstPantry(recipe, pantryNames);

        var allIngredients = recipe.Ingredients
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var have = allIngredients
            .Except(missing, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var sb = new StringBuilder();

        sb.AppendLine($"**{recipe.Title}**");
        sb.AppendLine();
        sb.AppendLine("Ingredients you have:");
        sb.AppendLine(have.Count > 0 ? string.Join("\n", have.Select(i => $"- {i}")) : "- (none yet)");
        sb.AppendLine();
        sb.AppendLine("Ingredients you still need to buy:");
        sb.AppendLine(missing.Count > 0 ? string.Join("\n", missing.Select(i => $"- {i}")) : "- (none — you have it all!)");
        sb.AppendLine();
        sb.AppendLine(missing.Count == 0
            ? "You can make this now."
            : $"You're missing {missing.Count} ingredient(s).");

        return Results.Ok(new { reply = sb.ToString().TrimEnd() });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- AI: Generate a brand-new recipe idea ----------
// The one deliberate exception to "existing recipes only" — this is the
// shortcut for when the user wants something new. NEVER used to answer
// "what can I make" or the weekly plan; those stay grounded in saved recipes.

app.MapPost("/api/ai/generate-recipe", async (GenerateRecipeRequest? req, Kernel kernel, HttpContext http) =>
{
    try
    {
        int userId = 1;
        var craving = req?.Craving?.Trim();

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();

        history.AddSystemMessage(
            $"You are a creative cooking assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their goal, diet type, and allergies. " +
            $"NEVER include any ingredient matching their listed allergies, even partially, and " +
            $"respect their diet type. Invent ONE brand-new recipe" +
            (string.IsNullOrWhiteSpace(craving) ? "." : $" involving: {craving}.") +
            " Respond with ONLY a JSON object, no prose, no markdown fences, in the form: " +
            "{\"title\":\"...\",\"category\":\"Breakfast|Veggie|Dessert|Thai|Grilled|Pasta|Soup|Salad|Sandwich|Curry|Seafood|Mexican|Italian|Asian|Mediterranean|Comfort Food|Quick & Easy|Healthy|Kids Friendly\"," +
            "\"ingredients\":\"comma, separated, list\",\"instructions\":\"numbered steps as one string\"," +
            "\"dietRestriction\":\"none|vegetarian|vegan|gluten-free|dairy-free|nut-free|low-carb|paleo|low-sodium|sugar-free|whole30|mediterranean|pescatarian|halal\"," +
            "\"allergens\":\"comma, separated, allergens, or, empty, string\"," +
            "\"imageUrl\":\"https://source.unsplash.com/featured/?food,cooking\"}");

        history.AddUserMessage(string.IsNullOrWhiteSpace(craving)
            ? "Surprise me with a new recipe."
            : $"Come up with a new recipe using {craving}.");

        var settings = new OpenAIPromptExecutionSettings
        {
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
        };

        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);

        var parsed = ParseGeneratedRecipe(result.Content ?? "");

        if (parsed == null)
        {
            return Results.Ok(new
            {
                reply = result.Content ?? "Sorry, I couldn't come up with a recipe that time. Please try again.",
                recipe = (object?)null
            });
        }

        var reply = $"**{parsed.Title}** ({parsed.Category})\n\n" +
            $"Diet: {parsed.DietRestriction}\n" +
            (string.IsNullOrWhiteSpace(parsed.Allergens) ? "" : $"Allergens: {parsed.Allergens}\n\n") +
            $"Ingredients: {parsed.Ingredients}\n\nInstructions:\n{parsed.Instructions}\n\n" +
            $"Image: {parsed.ImageUrl}";

        // Set owner as AI-Generated for AI-generated recipes
        parsed.OwnerName = "AI-Generated";

        return Results.Ok(new { reply, recipe = parsed });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- Save a generated (or manually written) recipe ----------

// deleted

// ---------- Dashboard Endpoints ----------


app.MapGet("/api/dashboard/stats", async (AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    int userId = UserIdResolver.GetUserId(user.Username);

    var totalRecipes = await db.Recipes.CountAsync(r => r.UserId == userId);
    var totalMealPlans = await db.MealPlans.CountAsync(m => m.UserId == userId);

    return Results.Ok(new
    {
        totalRecipes,
        totalMealPlans
    });
});

app.MapGet("/api/dashboard/recent-recipes", async (AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    int userId = UserIdResolver.GetUserId(user.Username);

    var recentRecipes = await db.Recipes
        .Where(r => r.UserId == userId)
        .OrderByDescending(r => r.Id)
        .Take(8)
        .Select(r => new
        {
            r.Id,
            r.Title,
            r.Category,
            r.Ingredients,
            r.ImageUrl,
            r.OwnerName,
            r.DietRestriction
        })
        .ToListAsync();

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
            .Select(ca => new
            {
                ca.RecipeCategory.Id,
                ca.RecipeCategory.Name,
                ca.RecipeCategory.Emoji,
                ca.RecipeCategory.ColorKey
            })
            .ToList()
    }).ToList();

    return Results.Ok(result);
});

app.MapGet("/api/dashboard/weekly-summary", async (AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    int userId = UserIdResolver.GetUserId(user.Username);

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
            Meals = g.Select(m => new
            {
                m.MealSlot,
                RecipeTitle = m.Recipe.Title
            })
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
        .Select(c => new
        {
            c.Id,
            c.Name,
            c.Emoji,
            c.ColorKey
        })
        .ToListAsync();

    return Results.Ok(categories);
});

// ---------- Pantry Endpoints ----------
app.MapGet("/api/pantry", async (AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    var pantryItems = await db.Pantries
        .Where(p => p.UserId == UserIdResolver.GetUserId(user.Username))
        .OrderBy(p => p.ExpiryDate)
        .ToListAsync();

    return Results.Ok(pantryItems);
});

app.MapGet("/api/pantry/{userId:int}", async (int userId, AppDbContext db, HttpContext http) =>
{
    var userIdError = ValidateUserId(http, userId);
    if (userIdError != null)
    {
        return userIdError;
    }

    var pantryItems = await db.Pantries
        .Where(p => p.UserId == userId)
        .OrderBy(p => p.Category)
        .ThenBy(p => p.IngredientName)
        .ToListAsync();

    return Results.Ok(pantryItems);
});
app.MapPost("/api/pantry", async (PantryRequest? req, AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    if (req == null)
    {
        return Results.BadRequest(new
        {
            message = "Pantry item data is required."
        });
    }

    if (string.IsNullOrWhiteSpace(req.IngredientName))
    {
        return Results.BadRequest(new
        {
            message = "Ingredient name is required."
        });
    }

    var pantryItem = new Pantry
    {
        UserId = UserIdResolver.GetUserId(user.Username),
        IngredientName = req.IngredientName.Trim(),
        Category = string.IsNullOrWhiteSpace(req.Category) ? "Other" : req.Category.Trim(),
        Quantity = req.Quantity > 0 ? req.Quantity : 1,
        Unit = req.Unit?.Trim() ?? "",
        ExpiryDate = req.ExpiryDate == default
            ? DateTime.UtcNow.AddDays(30)
            : req.ExpiryDate
    };

    db.Pantries.Add(pantryItem);
    await db.SaveChangesAsync();

    return Results.Ok(pantryItem);
});

app.MapPut("/api/pantry/{id:int}", async (int id, PantryRequest? req, AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    if (id <= 0)
    {
        return Results.BadRequest(new
        {
            message = "Pantry item ID must be valid."
        });
    }

    if (req == null)
    {
        return Results.BadRequest(new
        {
            message = "Pantry item data is required."
        });
    }

    var pantryItem = await db.Pantries
        .FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserIdResolver.GetUserId(user.Username));

    if (pantryItem == null)
    {
        return Results.NotFound(new
        {
            message = "Pantry item not found."
        });
    }

    pantryItem.IngredientName = req.IngredientName.Trim();
    pantryItem.Category = req.Category.Trim();
    pantryItem.Quantity = req.Quantity > 0 ? req.Quantity : 1;
    pantryItem.Unit = req.Unit?.Trim() ?? "";
    pantryItem.ExpiryDate = req.ExpiryDate == default
        ? pantryItem.ExpiryDate
        : req.ExpiryDate;

    await db.SaveChangesAsync();

    return Results.Ok(pantryItem);
});

app.MapDelete("/api/pantry/{id:int}", async (int id, AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    if (id <= 0)
    {
        return Results.BadRequest(new
        {
            message = "Pantry item ID must be valid."
        });
    }

    var pantryItem = await db.Pantries
        .FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserIdResolver.GetUserId(user.Username));

    if (pantryItem == null)
    {
        return Results.NotFound(new
        {
            message = "Pantry item not found."
        });
    }

    db.Pantries.Remove(pantryItem);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        message = "Pantry item deleted successfully."
    });
});

// ---------- Receipt Parser ----------

app.MapPost("/api/receipt/parse", async (HttpRequest req, HttpContext http) =>
{
    var chatClient = visionChat;

    if (chatClient is null)
    {
        return ApiError(
            http,
            StatusCodes.Status503ServiceUnavailable,
            "AI is not configured. Please set the GoogleAI API key.");
    }

    if (!req.HasFormContentType)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Please upload an image using form-data.");
    }

    var form = await req.ReadFormAsync();
    var file = form.Files["image"];

    if (file is null || file.Length == 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "No image uploaded.");
    }

    if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Uploaded file must be an image.");
    }

    if (file.Length > 5_000_000)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Image is too large. Please upload an image under 5 MB.");
    }

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);

    var image = new DataContent(ms.ToArray(), file.ContentType ?? "image/jpeg");

    const string prompt =
        "Read this grocery receipt. Extract every grocery item purchased. " +
        "For each item return its name, a numeric quantity if shown, a unit of measurement, and categorize it into one of: Vegetables, Fruits, Grains, Proteins, Dairy, Spices, Oils, Beverages, Snacks, Other. " +
        "Ignore prices, totals, tax, store name, and dates. " +
        "Return as a JSON array like: [{\"name\":\"chicken breast\",\"quantity\":\"500\",\"unit\":\"g\",\"category\":\"Proteins\"}, ...]";

    var message = new ChatMessage(
        ChatRole.User,
        [new Microsoft.Extensions.AI.TextContent(prompt), image]);

    try
    {
        var result = await chatClient.GetResponseAsync<List<ParsedItem>>([message]);
        return Results.Ok(result.Result ?? new List<ParsedItem>());
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// ---------- Object Detection ----------

app.MapPost("/api/detect", async (HttpRequest req, HttpContext http) =>
{
    var chatClient = visionChat;

    if (chatClient is null)
    {
        return ApiError(
            http,
            StatusCodes.Status503ServiceUnavailable,
            "AI is not configured. Please set the GoogleAI API key.");
    }

    if (!req.HasFormContentType)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Please upload an image using form-data.");
    }

    var form = await req.ReadFormAsync();
    var file = form.Files["image"];

    if (file is null || file.Length == 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "No image uploaded.");
    }

    if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Uploaded file must be an image.");
    }

    if (file.Length > 5_000_000)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "Image is too large. Please upload an image under 5 MB.");
    }

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);

    var image = new DataContent(ms.ToArray(), file.ContentType ?? "image/jpeg");

    const string detectPrompt =
        "Detect every prominent food or grocery item in this image. " +
        "For each object return a short label, a confidence between 0 and 1, " +
        "a bounding box as yMin, xMin, yMax, xMax normalised to a 0-1000 scale, " +
        "a typical unit of measurement, and categorize it into one of: Vegetables, Fruits, Grains, Proteins, Dairy, Spices, Oils, Beverages, Snacks, Other. " +
        "Also write a one-sentence summary. " +
        "Return as JSON: {\"objects\":[{\"label\":\"...\",\"confidence\":0.95,\"yMin\":100,\"xMin\":200,\"yMax\":300,\"xMax\":400,\"unit\":\"pieces\",\"category\":\"Vegetables\"},...],\"summary\":\"...\"}";

    var message = new ChatMessage(
        ChatRole.User,
        [new Microsoft.Extensions.AI.TextContent(detectPrompt), image]);

    try
    {
        var result = await chatClient.GetResponseAsync<DetectionResult>([message]);
        return Results.Ok(result.Result);
    }
    catch (Exception ex)
    {
        return HandleAiError(ex, http);
    }
});

// Bulk-add parsed receipt/detection items into the Pantry table.
// Items are first merged by name *within this batch* (so e.g. two "tomato"
// detections in one photo become one entry with Quantity 2, instead of two
// separate rows) before checking against existing pantry rows.
// A purely numeric quantity (e.g. "2") is treated as a count and summed;
// anything else (e.g. "500g", "1 bottle") is treated as a descriptive unit,
// and counts as a single occurrence of that item.

app.MapPost("/api/pantry/bulk-add", async (List<ParsedItem>? items, AppDbContext db, HttpContext http) =>
{
    var user = await GetCurrentUserAsync(db, http);

    if (user == null)
        return Results.Unauthorized();

    int userId = UserIdResolver.GetUserId(user.Username);

    if (items == null || items.Count == 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "No items provided.");
    }

    var grouped = new Dictionary<string, (string DisplayName, int Count, string? Unit, string? Category)>(
        StringComparer.OrdinalIgnoreCase);

    foreach (var item in items)
    {
        if (string.IsNullOrWhiteSpace(item.Name))
        {
            continue;
        }

        var name = item.Name.Trim();
        var key = name.ToLowerInvariant();

        int count = 1;
        string? unit = null;
        string? category = item.Category?.Trim() ?? "Other";

        if (!string.IsNullOrWhiteSpace(item.Unit))
        {
            // New-style: quantity is a real number, unit is separate.
            unit = item.Unit.Trim();

            if (int.TryParse(item.Quantity?.Trim(), out var parsedCount) && parsedCount > 0)
            {
                count = parsedCount;
            }
        }
        else if (!string.IsNullOrWhiteSpace(item.Quantity))
        {
            // Legacy fallback: quantity text alone, e.g. "500g" or "2".
            var qtyText = item.Quantity.Trim();

            if (int.TryParse(qtyText, out var parsedCount) && parsedCount > 0)
            {
                count = parsedCount;
            }
            else
            {
                unit = qtyText;
            }
        }

        if (grouped.TryGetValue(key, out var existingGroup))
        {
            grouped[key] = (
                existingGroup.DisplayName,
                existingGroup.Count + count,
                unit ?? existingGroup.Unit,
                category
            );
        }
        else
        {
            grouped[key] = (name, count, unit, category);
        }
    }

    if (grouped.Count == 0)
    {
        return ApiError(
            http,
            StatusCodes.Status400BadRequest,
            "No valid pantry items were provided.");
    }

    foreach (var group in grouped.Values)
    {
        var existing = await db.Pantries.FirstOrDefaultAsync(p =>
            p.UserId == userId &&
            p.IngredientName.ToLower() == group.DisplayName.ToLower());

        if (existing != null)
        {
            existing.Quantity += group.Count;

            if (!string.IsNullOrWhiteSpace(group.Unit))
            {
                existing.Unit = group.Unit;
            }
        }
        else
        {
            db.Pantries.Add(new Pantry
            {
                UserId = userId,
                IngredientName = group.DisplayName,
                Category = group.Category ?? "Other",
                Quantity = group.Count,
                Unit = group.Unit ?? "",
                ExpiryDate = DateTime.Now.AddDays(14) // rough default; adjust per item type if desired
            });
        }
    }

    await db.SaveChangesAsync();

    return Results.Ok(new { message = $"{grouped.Count} item(s) added to pantry." });
});

// ---------- Profile/Chart Endpoints ----------

app.MapGet("/api/profile/meal-stats/{userId:int}", async (int userId, AppDbContext db, HttpContext http) =>
{
    var userIdError = ValidateUserId(http, userId);
    if (userIdError != null)
    {
        return userIdError;
    }

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

app.MapGet("/api/profile/recent-activity/{userId:int}", async (int userId, AppDbContext db, HttpContext http) =>
{
    var userIdError = ValidateUserId(http, userId);
    if (userIdError != null)
    {
        return userIdError;
    }

    var recentRecipes = await db.Recipes
        .Where(r => r.UserId == userId)
        .OrderByDescending(r => r.Id)
        .Take(5)
        .Select(r => new
        {
            Type = "Recipe",
            Title = r.Title,
            Timestamp = DateTime.Now.AddDays(-r.Id)
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
            Timestamp = DateTime.Now.AddDays(-m.Id)
        })
        .ToListAsync();

    var allActivity = recentRecipes
        .Concat(recentMealPlans)
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
record PantryRequest(string IngredientName, string Category, int Quantity, string Unit, DateTime ExpiryDate);
record ParsedItem(string Name, string? Quantity, string? Unit, string? Category);
record MealCheckRequest(int RecipeId);
record DetectedObject(string Label, double Confidence, int YMin, int XMin, int YMax, int XMax, string? Unit, string? Category);
record DetectionResult(List<DetectedObject> Objects, string Summary);
record GenerateRecipeRequest(string? Craving);
record GeneratedRecipe(string Title, string Category, string Ingredients, string Instructions, string DietRestriction, string Allergens, string ImageUrl)
{
    public string OwnerName { get; set; } = "AI-Generated";
}

