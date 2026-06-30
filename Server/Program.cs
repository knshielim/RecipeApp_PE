using System.ClientModel;
using Microsoft.Extensions.AI;
using OpenAI;
 
var builder = WebApplication.CreateBuilder(args);
 
// let the React app (port 5173) call this API
builder.Services.AddCors(o => o.AddDefaultPolicy(
    p => p.AllowAnyOrigin()
          .AllowAnyHeader().AllowAnyMethod()));
 
var app = builder.Build();
app.UseCors();
 
// read the key stored with user-secrets
string apiKey = builder.Configuration["GoogleAI:ApiKey"]
    ?? throw new Exception("GoogleAI:ApiKey not found");
 
// build an IChatClient backed by Gemini
var options = new OpenAIClientOptions
{
    Endpoint = new Uri(
        "https://generativelanguage.googleapis.com/v1beta/openai/")
};
IChatClient client =
    new OpenAIClient(new ApiKeyCredential(apiKey), options)
        .GetChatClient("gemini-2.5-flash").AsIChatClient();
 
// POST /api/chat -> { reply: "..." }
app.MapPost("/api/chat", async (ChatRequest req) =>
{
    var history = new List<ChatMessage> {
        new(ChatRole.System, "You are a helpful SWE310 tutor.") };
    foreach (var m in req.Messages)
        history.Add(new ChatMessage(m.Role == "user"
            ? ChatRole.User : ChatRole.Assistant, m.Text));
    var res = await client.GetResponseAsync(history);
    return Results.Ok(new { reply = res.Text });
});
 
app.Run("http://localhost:5237");
 
record ChatDto(string Role, string Text);
record ChatRequest(List<ChatDto> Messages);
