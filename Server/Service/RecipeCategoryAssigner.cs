using Server.Models;



namespace Server.Services;



public static class RecipeCategoryAssigner

{

    public static void EnsureAssignments(AppDbContext db)

    {

        var allCategories = db.RecipeCategories

            .ToDictionary(c => c.Name, c => c.Id, StringComparer.OrdinalIgnoreCase);



        foreach (var recipe in db.Recipes)

        {

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);



            if (!string.IsNullOrWhiteSpace(recipe.Category))

                names.Add(recipe.Category.Trim());



            foreach (var name in InferCategories(recipe))

                names.Add(name);



            foreach (var name in names)

            {

                if (!allCategories.TryGetValue(name, out var categoryId))

                    continue;



                var exists = db.RecipeCategoryAssignments.Any(rca =>

                    rca.RecipeId == recipe.Id && rca.RecipeCategoryId == categoryId);



                if (exists)

                    continue;



                db.RecipeCategoryAssignments.Add(new RecipeCategoryAssignment

                {

                    RecipeId = recipe.Id,

                    RecipeCategoryId = categoryId

                });

            }

        }



        db.SaveChanges();

    }



    public static void RemoveUnusedCategories(AppDbContext db, params string[] names)

    {

        foreach (var name in names)

        {

            var cat = db.RecipeCategories.FirstOrDefault(c => c.Name == name);

            if (cat is null) continue;



            db.RecipeCategoryAssignments.RemoveRange(

                db.RecipeCategoryAssignments.Where(rca => rca.RecipeCategoryId == cat.Id));

            db.RecipeCategories.Remove(cat);

        }



        db.SaveChanges();

    }



  public static IEnumerable<string> InferCategories(Recipe recipe)

    {

        var title = (recipe.Title ?? "").Trim();

        var ingredients = (recipe.Ingredients ?? "").Trim();

        var t = title.ToLowerInvariant();

        var i = ingredients.ToLowerInvariant();

        var hay = $"{t} {i}";



        if (IsPastaDish(t, i))

            yield return "Pasta";



        if (ContainsAny(t, "salad", "waldorf", "cobb"))

            yield return "Salad";



        if (t.Contains("bowl") && t.Contains("salad"))

            yield return "Salad";



        if (ContainsAny(t, "soup"))

            yield return "Soup";



        if (ContainsAny(t, "sandwich", "blt", "grilled cheese", "pb&j", "club sandwich")

            || t.Contains("wrap"))

            yield return "Sandwich";



        if (t.StartsWith("grilled ") || t.Contains("bbq"))

            yield return "Grilled";



        if (ContainsAny(t, "taco", "burrito", "fajita", "quesadilla")

            || t.Contains("tortilla soup"))

            yield return "Mexican";



        if (ContainsAny(t, "pad thai", "tom yum", "thai red curry", "green curry"))

            yield return "Thai";



        if (ContainsAny(t, "stir fry", "fried rice", "spring roll", "ramen", "teriyaki",

                "sushi", "poke", "bulgogi", "garlic noodles", "noodle soup", "pad thai",

                "tom yum")

            || (t.Contains("bowl") && !t.Contains("smoothie")))

            yield return "Asian";



        if (ContainsAny(t, "risotto", "parmesan", "parmigiana", "caprese", "minestrone",

                "bolognese", "carbonara", "alfredo", "lasagna", "pesto pasta", "primavera")

            || (IsPastaDish(t, i) && !t.Contains("ramen")))

            yield return "Italian";



        if (ContainsAny(t, "falafel", "greek salad", "mediterranean"))

            yield return "Mediterranean";



        if (ContainsAny(hay, "salmon", "shrimp", "fish", "tuna", "crab"))

            yield return "Seafood";



        if (ContainsAny(t, "curry", "masala", "tikka"))

            yield return "Curry";



        if (ContainsAny(t, "veggie", "vegetable curry", "chana", "stuffed bell",

                "roasted vegetables", "lentil soup", "falafel", "buddha"))

            yield return "Veggie";



        if (ContainsAny(t, "buddha", "quinoa", "smoothie bowl", "parfait", "overnight oats",

                "roasted vegetables", "zucchini noodles", "butternut squash"))

            yield return "Healthy";



        if (ContainsAny(t, "scrambled eggs", "instant ramen", "toast with jam", "quesadilla",

                "egg muffins", "fried rice with egg", "peanut butter toast", "egg fried toast"))

            yield return "Quick & Easy";



        if (ContainsAny(t, "nuggets", "pizza bagels", "macaroni and cheese", "cereal",

                "mini pizzas", "pb&j", "banana pancakes", "berry yogurt"))

            yield return "Kids Friendly";



        if (ContainsAny(t, "oatmeal", "pancakes", "omelette", "french toast", "overnight oats",

                "avocado toast", "breakfast burrito", "breakfast smoothie", "egg muffins",

                "greek yogurt", "french toast", "spinach mushroom")

            && !ContainsAny(t, "chia pudding", "pot pie", "shepherd"))

            yield return "Breakfast";



        if (ContainsAny(t, "stew", "pot pie", "shepherd", "meatloaf", "mashed potatoes",

                "mac and cheese", "fish and chips"))

            yield return "Comfort Food";



        if (ContainsAny(t, "cake", "brownies", "ice cream", "chia pudding")

            && !ContainsAny(t, "pot pie", "shepherd", "rice cake"))

            yield return "Dessert";



        if (t.Contains("apple pie"))

            yield return "Dessert";

    }



    private static bool IsPastaDish(string title, string ingredients)

    {

        if (ContainsAny(title, "ramen", "pad thai", "zucchini noodles", "garlic noodles",

                "noodle soup", "fried rice"))

            return false;



        if (title.Contains("noodle")

            && !ContainsAny(ingredients, "pasta", "macaroni", "spaghetti", "fettuccine"))

            return false;



        if (ContainsAny(title, "pasta", "spaghetti", "bolognese", "carbonara", "alfredo",

                "lasagna", "mac and cheese", "macaroni and cheese", "primavera", "pesto pasta"))

            return true;



        return ContainsAny(ingredients, "pasta", "spaghetti", "macaroni", "fettuccine");

    }



    private static bool ContainsAny(string text, params string[] terms)

    {

        foreach (var term in terms)

        {

            if (text.Contains(term, StringComparison.OrdinalIgnoreCase))

                return true;

        }



        return false;

    }

}


