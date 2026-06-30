using System.ClientModel;
using System.Security.Claims;
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

var kernelBuilder = Kernel.CreateBuilder();
kernelBuilder.AddOpenAIChatCompletion(
    modelId: "gemini-2.5-flash",
    apiKey: apiKey,
    endpoint: new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"));
kernelBuilder.Plugins.AddFromType<RecipeDataPlugin>("RecipeData");
builder.Services.AddScoped(_ => kernelBuilder.Build());

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

// ---------- Endpoints ----------

app.MapPost("/api/ai/assistant", async (
    ChatRequest req,
    Kernel kernel) =>
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
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/ai/suggest-meal", async (Kernel kernel) =>
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
});

app.MapPost("/api/ai/summarize-recipes", async (Kernel kernel) =>
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
});

app.Run("http://localhost:5237");

// ---------- Records ----------

record ChatRequest(string Message);