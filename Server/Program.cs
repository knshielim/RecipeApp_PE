using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;

var builder = WebApplication.CreateBuilder(args);

// ---------- Services ----------

builder.Services.AddCors(o => o.AddDefaultPolicy(
    p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite("Data Source=ai_assistant_dev.db"));

string apiKey = builder.Configuration["GoogleAI:ApiKey"]
    ?? throw new Exception("GoogleAI:ApiKey not found");

builder.Services.AddScoped<Kernel>(sp =>
{
    var kernelBuilder = Kernel.CreateBuilder();
    kernelBuilder.AddOpenAIChatCompletion(
        modelId: "gemini-2.5-flash",
        apiKey: apiKey,
        endpoint: new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"));

    var kernel = kernelBuilder.Build();

    var db = sp.GetRequiredService<AppDbContext>();
    var plugin = new RecipeDataPlugin(db);
    kernel.Plugins.AddFromObject(plugin, "RecipeData");

    return kernel;
});

// ---------- Build ----------

var app = builder.Build();
app.UseCors();

// seed some test data so the AI has something to read
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

app.Run("http://localhost:5237");

// ---------- Records ----------

record ChatRequest(string Message);
record SavePreferencesRequest(int UserId, string Goal, string DietType, string Allergies);