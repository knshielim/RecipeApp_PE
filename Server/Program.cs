using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.Extensions.AI;
using System.ClientModel;
using OpenAI;
using Microsoft.IdentityModel.Tokens;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

// ================================================================
// ---------- Services (verbatim from Document 1 — untouched) ----------
// ================================================================

builder.Services.AddCors(o => o.AddDefaultPolicy(
    p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite("Data Source=ai_assistant_dev.db"));

// GoogleAI:ApiKey is now optional: without it the app still starts and
// login/non-AI features work fine. Only the AI/vision endpoints will
// return a "not configured" response until a real key is added.
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

// ================================================================
// ---------- Additive services merged in from Document 2 ----------
// (These only ADD capability; they don't touch CORS or the DbContext.)
// ================================================================

builder.Services.AddControllers();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<UserStore>();
builder.Services.AddScoped<IMealPlanSuggester, MealPlanSuggester>(); // Meal Planning module (Member 3)

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Guarded: if Server:Key isn't configured yet, JWT auth is simply
        // inert instead of crashing the app at startup (Document 2's
        // version used `!` and would throw NullReferenceException here).
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
app.UseCors();

// Additive: enables [Authorize] controllers/endpoints if/when you add them.
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// seed some test data so the AI has something to read (verbatim, Document 1)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    if (!db.Recipes.Any())
    {
        db.Recipes.Add(new Recipe
        {
            UserId = 1,
            Title = "Chicken Stir Fry",
            Ingredients = "chicken, soy sauce, broccoli, rice",
            Category = "Dinner"
        });
        db.SaveChanges();
    }

    // ---- Additive seed data merged from Document 2 ----
    // Only runs if these tables are still empty; does not touch the
    // Recipes seed block above.
    if (!db.MealPlans.Any())
    {
        var recipes = db.Recipes.Where(r => r.UserId == 1).ToList();
        if (recipes.Count > 0)
        {
            db.MealPlans.Add(new MealPlan { UserId = 1, Day = "Monday", MealSlot = "dinner", RecipeId = recipes[0].Id });
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
}

// ================================================================
// Everything below this line is Document 1, completely unchanged:
// vision client, HandleAiError, every /api/... endpoint, and records.
// ================================================================

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

    return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status500InternalServerError);
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

app.MapPost("/api/ai/weekly-plan", async (Kernel kernel) =>
{
    int userId = 1; // TODO: replace with real authenticated user id later

    try
    {
        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a meal-planning assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their goal, diet type, and allergies. " +
            $"NEVER include any ingredient matching their listed allergies, even partially " +
            $"(e.g. if 'peanuts' is an allergy, avoid peanut butter, peanut oil, etc). " +
            $"Then call get_user_recipes to see what they have saved, and call " +
            $"get_weekly_meal_plan to check for any existing plan. " +
            $"Generate a full 7-day meal plan (breakfast, lunch, dinner) using their saved " +
            $"recipes where possible, formatted as a clear day-by-day list. If their goal is " +
            $"'bulking', favour higher-calorie/protein options; if 'cutting', favour lighter, " +
            $"lower-calorie options.");
        history.AddUserMessage("Generate a weekly meal plan for me.");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
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

app.MapPost("/api/ai/what-can-i-make", async (Kernel kernel) =>
{
    try
    {
        int userId = 1; // TODO: replace with real user id

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a helpful cooking assistant. The current user's id is {userId}. " +
            $"First call get_user_preferences to check their dietary goal and allergies — " +
            $"NEVER suggest meals containing listed allergens. " +
            $"Then call get_pantry_items to see what ingredients they currently have. " +
            $"Suggest 3 meals they can make RIGHT NOW using only what's in their pantry. " +
            $"For each meal, list which pantry ingredients it uses. Keep suggestions practical and simple.");
        history.AddUserMessage("What can I make with my current ingredients?");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
});

// ---------- AI: Am I missing any ingredients for a specific meal? ----------

app.MapPost("/api/ai/missing-ingredients", async (MealCheckRequest req, Kernel kernel) =>
{
    if (string.IsNullOrWhiteSpace(req.Meal))
        return Results.BadRequest(new { error = "Please provide a meal name." });

    try
    {
        int userId = 1; // TODO: replace with real user id

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddSystemMessage(
            $"You are a kitchen assistant. The current user's id is {userId}. " +
            $"Call get_pantry_items to see what the user currently has. " +
            $"The user wants to make: {req.Meal}. " +
            $"List ALL ingredients typically needed to make this dish. " +
            $"Then check each one against the pantry. " +
            $"Clearly separate your response into two sections: " +
            $"'✅ Ingredients you have' and '❌ Ingredients you still need to buy'. " +
            $"At the end, give a one-sentence verdict on whether they can make it now or not.");
        history.AddUserMessage($"Do I have everything I need to make {req.Meal}?");

        var settings = new OpenAIPromptExecutionSettings { FunctionChoiceBehavior = FunctionChoiceBehavior.Auto() };
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        return Results.Ok(new { reply = result.Content });
    }
    catch (Exception ex)
    {
        return HandleAiError(ex);
    }
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
        .Select(r => new { r.Id, r.Title, r.Category, r.Ingredients })
        .ToListAsync();

    return Results.Ok(recentRecipes);
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

// ---------- Records ----------

record ChatRequest(string Message);
record SavePreferencesRequest(int UserId, string Goal, string DietType, string Allergies);
record PantryRequest(int UserId, string IngredientName, string Category, int Quantity, string Unit, DateTime ExpiryDate);
record ParsedItem(string Name, string? Quantity, string? Unit);
record MealCheckRequest(string Meal);
record DetectedObject(string Label, double Confidence, int YMin, int XMin, int YMax, int XMax, string? Unit);
record DetectionResult(List<DetectedObject> Objects, string Summary);
