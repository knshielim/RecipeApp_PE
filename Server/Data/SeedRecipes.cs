namespace Server.Data;

using Server.Models;

public static class SeedRecipes
{
    public static Recipe[] GetSeedRecipes()
    {
        return new Recipe[]
        {
            // Breakfast
            new Recipe
            {
                UserId = 1,
                Title = "Overnight Oats",
                Ingredients = "rolled oats, milk, honey, banana, berries",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Banana Pancakes",
                Ingredients = "banana, eggs, flour, milk, baking powder",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Avocado Toast",
                Ingredients = "bread, avocado, lemon juice, tomato, salt",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Greek Yogurt Parfait",
                Ingredients = "greek yogurt, granola, honey, strawberries, blueberries",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Spinach Mushroom Omelette",
                Ingredients = "eggs, spinach, mushrooms, cheese, olive oil",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "French Toast",
                Ingredients = "bread, eggs, milk, cinnamon, vanilla, maple syrup",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Breakfast Smoothie",
                Ingredients = "banana, berries, yogurt, honey, spinach",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Egg Muffins",
                Ingredients = "eggs, cheese, spinach, bell pepper, onion",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Breakfast Burrito",
                Ingredients = "tortilla, eggs, beans, cheese, salsa",
                Category = "Mexican"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Peanut Butter Toast",
                Ingredients = "bread, peanut butter, banana, honey",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Smoothie Bowl",
                Ingredients = "banana, berries, yogurt, granola, chia seeds",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Egg Fried Toast",
                Ingredients = "bread, eggs, butter, cheese, black pepper",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chia Pudding",
                Ingredients = "chia seeds, milk, honey, mango, coconut",
                Category = "Dessert"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Apple Cinnamon Oatmeal",
                Ingredients = "rolled oats, apple, cinnamon, milk, honey",
                Category = "Breakfast"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Berry Yogurt Parfait",
                Ingredients = "yogurt, mixed berries, granola, honey",
                Category = "Kids Friendly"
            },

            // Bowls
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Rice Bowl",
                Ingredients = "chicken breast, rice, broccoli, carrot, soy sauce",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Salmon Quinoa Bowl",
                Ingredients = "salmon, quinoa, cucumber, lettuce, lemon juice",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Sushi Bowl",
                Ingredients = "rice, seaweed, cucumber, avocado, salmon",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Falafel Bowl",
                Ingredients = "falafel, rice, cucumber, lettuce, yogurt sauce",
                Category = "Mediterranean"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Beef Bulgogi Bowl",
                Ingredients = "beef, rice, soy sauce, sesame oil, onion",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Tofu Teriyaki Bowl",
                Ingredients = "tofu, rice, broccoli, teriyaki sauce, sesame oil",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Egg Salad Bowl",
                Ingredients = "eggs, lettuce, potato, cucumber, mayonnaise",
                Category = "Salad"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Buddha Bowl",
                Ingredients = "quinoa, chickpeas, avocado, sweet potato, tahini",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Poke Bowl",
                Ingredients = "rice, tuna, avocado, edamame, cucumber, soy sauce",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Mediterranean Bowl",
                Ingredients = "rice, hummus, olives, feta, cucumber, tomato",
                Category = "Mediterranean"
            },

            // Tacos & Wraps
            new Recipe
            {
                UserId = 1,
                Title = "Chickpea Salad Wrap",
                Ingredients = "tortilla, chickpeas, lettuce, tomato, yogurt dressing",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Black Bean Tacos",
                Ingredients = "tortilla, black beans, lettuce, tomato, cheese",
                Category = "Mexican"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Fajitas",
                Ingredients = "chicken, tortilla, bell pepper, onion, salsa",
                Category = "Mexican"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Caesar Wrap",
                Ingredients = "tortilla, chicken, lettuce, parmesan, caesar dressing",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Fish Tacos",
                Ingredients = "tortilla, fish, cabbage, lime, crema",
                Category = "Mexican"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Veggie Wrap",
                Ingredients = "tortilla, hummus, vegetables, cheese",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Quesadilla",
                Ingredients = "tortilla, cheese, chicken, peppers",
                Category = "Mexican"
            },

            // Veggie
            new Recipe
            {
                UserId = 1,
                Title = "Vegetable Fried Rice",
                Ingredients = "rice, peas, carrot, corn, soy sauce",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Lentil Soup",
                Ingredients = "lentils, carrot, onion, garlic, vegetable stock",
                Category = "Soup"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Veggie Noodle Soup",
                Ingredients = "noodles, carrot, cabbage, mushrooms, vegetable stock",
                Category = "Soup"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Vegetable Curry",
                Ingredients = "potato, carrot, cauliflower, coconut milk, curry powder",
                Category = "Curry"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Eggplant Parmesan",
                Ingredients = "eggplant, tomato sauce, mozzarella, parmesan, basil",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Sweet Potato Curry",
                Ingredients = "sweet potato, chickpeas, coconut milk, spinach, curry powder",
                Category = "Curry"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Mushroom Risotto",
                Ingredients = "rice, mushrooms, onion, parmesan, vegetable stock",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Stuffed Bell Peppers",
                Ingredients = "bell peppers, rice, tomato sauce, cheese",
                Category = "Veggie"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Roasted Vegetables",
                Ingredients = "broccoli, cauliflower, carrot, olive oil, herbs",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Zucchini Noodles",
                Ingredients = "zucchini, tomato sauce, parmesan, basil",
                Category = "Healthy"
            },

            // Asian
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Stir Fry",
                Ingredients = "chicken, soy sauce, broccoli, rice",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Shrimp Garlic Noodles",
                Ingredients = "shrimp, noodles, garlic, butter, soy sauce",
                Category = "Asian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Pad Thai",
                Ingredients = "rice noodles, shrimp, peanuts, bean sprouts, tamarind",
                Category = "Thai"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Tom Yum Soup",
                Ingredients = "shrimp, lemongrass, mushrooms, chili, lime",
                Category = "Thai"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Green Curry",
                Ingredients = "chicken, coconut milk, green curry paste, vegetables",
                Category = "Thai"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Fried Rice with Egg",
                Ingredients = "rice, egg, peas, carrot, soy sauce",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Spring Rolls",
                Ingredients = "rice paper, vegetables, shrimp, peanut sauce",
                Category = "Asian"
            },

            // Grilled & Seafood
            new Recipe
            {
                UserId = 1,
                Title = "Baked Salmon",
                Ingredients = "salmon, potato, green beans, lemon juice, olive oil",
                Category = "Seafood"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Grilled Chicken Salad",
                Ingredients = "chicken, lettuce, cucumber, tomato, olive oil",
                Category = "Salad"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Beef Stew",
                Ingredients = "beef, potato, carrot, onion, beef stock",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Grilled Shrimp",
                Ingredients = "shrimp, garlic, lemon, olive oil, herbs",
                Category = "Seafood"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Fish and Chips",
                Ingredients = "fish, potatoes, tartar sauce, lemon",
                Category = "Seafood"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Grilled Steak",
                Ingredients = "steak, salt, pepper, butter, herbs",
                Category = "Grilled"
            },
            new Recipe
            {
                UserId = 1,
                Title = "BBQ Ribs",
                Ingredients = "ribs, bbq sauce, spices, onion",
                Category = "Grilled"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Grilled Vegetables",
                Ingredients = "zucchini, bell pepper, eggplant, olive oil",
                Category = "Healthy"
            },

            // Pasta
            new Recipe
            {
                UserId = 1,
                Title = "Tuna Pasta Salad",
                Ingredients = "pasta, tuna, corn, cucumber, mayonnaise",
                Category = "Pasta"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Pesto Pasta",
                Ingredients = "pasta, pesto, parmesan, cherry tomato, olive oil",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Spaghetti Bolognese",
                Ingredients = "spaghetti, minced beef, tomato sauce, onion, garlic",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Mac and Cheese",
                Ingredients = "macaroni, cheddar cheese, milk, butter",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Carbonara",
                Ingredients = "spaghetti, eggs, bacon, parmesan, black pepper",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Alfredo Pasta",
                Ingredients = "fettuccine, cream, parmesan, butter, garlic",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Pasta Primavera",
                Ingredients = "pasta, vegetables, olive oil, parmesan",
                Category = "Healthy"
            },

            // Soup
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Noodle Soup",
                Ingredients = "chicken, noodles, carrot, celery, onion",
                Category = "Soup"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Tomato Soup",
                Ingredients = "tomato, onion, garlic, basil, cream",
                Category = "Soup"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Minestrone",
                Ingredients = "vegetables, beans, pasta, tomato, broth",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Butternut Squash Soup",
                Ingredients = "butternut squash, onion, garlic, cream",
                Category = "Healthy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Tortilla Soup",
                Ingredients = "chicken, tortilla, tomato, beans, spices",
                Category = "Mexican"
            },

            // Salad
            new Recipe
            {
                UserId = 1,
                Title = "Caesar Salad",
                Ingredients = "romaine, croutons, parmesan, caesar dressing",
                Category = "Salad"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Greek Salad",
                Ingredients = "cucumber, tomato, feta, olives, olive oil",
                Category = "Mediterranean"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Cobb Salad",
                Ingredients = "lettuce, chicken, bacon, egg, avocado, blue cheese",
                Category = "Salad"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Waldorf Salad",
                Ingredients = "apple, celery, walnuts, grapes, mayonnaise",
                Category = "Salad"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Quinoa Salad",
                Ingredients = "quinoa, vegetables, lemon, olive oil",
                Category = "Healthy"
            },

            // Sandwich
            new Recipe
            {
                UserId = 1,
                Title = "Turkey Sandwich",
                Ingredients = "bread, turkey, lettuce, tomato, cheese",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Caprese Sandwich",
                Ingredients = "bread, mozzarella, tomato, basil, olive oil",
                Category = "Italian"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Grilled Cheese",
                Ingredients = "bread, cheddar cheese, butter",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "BLT Sandwich",
                Ingredients = "bread, bacon, lettuce, tomato, mayonnaise",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Club Sandwich",
                Ingredients = "bread, turkey, bacon, lettuce, tomato",
                Category = "Sandwich"
            },
            new Recipe
            {
                UserId = 1,
                Title = "PB&J Sandwich",
                Ingredients = "bread, peanut butter, jelly",
                Category = "Kids Friendly"
            },

            // Curry
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Tikka Masala",
                Ingredients = "chicken, tomato sauce, cream, spices",
                Category = "Curry"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Butter Chicken",
                Ingredients = "chicken, tomato, butter, cream, spices",
                Category = "Curry"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Thai Red Curry",
                Ingredients = "chicken, coconut milk, red curry paste, vegetables",
                Category = "Thai"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Lamb Curry",
                Ingredients = "lamb, onion, tomato, yogurt, spices",
                Category = "Curry"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chana Masala",
                Ingredients = "chickpeas, tomato, onion, spices",
                Category = "Veggie"
            },

            // Dessert
            new Recipe
            {
                UserId = 1,
                Title = "Chocolate Cake",
                Ingredients = "flour, sugar, cocoa, eggs, butter",
                Category = "Dessert"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Apple Pie",
                Ingredients = "apples, flour, sugar, butter, cinnamon",
                Category = "Dessert"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Ice Cream Sundae",
                Ingredients = "ice cream, chocolate syrup, whipped cream, cherry",
                Category = "Kids Friendly"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Brownies",
                Ingredients = "chocolate, butter, sugar, eggs, flour",
                Category = "Dessert"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Fruit Salad",
                Ingredients = "mixed fruits, honey, lime, mint",
                Category = "Healthy"
            },

            // Comfort Food
            new Recipe
            {
                UserId = 1,
                Title = "Meatloaf",
                Ingredients = "ground beef, breadcrumbs, onion, tomato sauce",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Mashed Potatoes",
                Ingredients = "potatoes, butter, milk, salt",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Pot Pie",
                Ingredients = "chicken, vegetables, gravy, pie crust",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Shepherd's Pie",
                Ingredients = "ground beef, vegetables, mashed potatoes",
                Category = "Comfort Food"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Lasagna",
                Ingredients = "pasta, meat sauce, ricotta, mozzarella",
                Category = "Italian"
            },

            // Quick & Easy
            new Recipe
            {
                UserId = 1,
                Title = "Scrambled Eggs",
                Ingredients = "eggs, butter, salt, pepper",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Instant Ramen",
                Ingredients = "ramen noodles, egg, green onions",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Toast with Jam",
                Ingredients = "bread, jam, butter",
                Category = "Quick & Easy"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Cereal",
                Ingredients = "cereal, milk",
                Category = "Kids Friendly"
            },

            // Kids Friendly
            new Recipe
            {
                UserId = 1,
                Title = "Chicken Nuggets",
                Ingredients = "chicken, breadcrumbs, spices",
                Category = "Kids Friendly"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Pizza Bagels",
                Ingredients = "bagels, tomato sauce, cheese, pepperoni",
                Category = "Kids Friendly"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Fruit Smoothie",
                Ingredients = "mixed fruits, yogurt, honey",
                Category = "Kids Friendly"
            },
            new Recipe
            {
                UserId = 1,
                Title = "Mini Pizzas",
                Ingredients = "pita bread, tomato sauce, cheese, vegetables",
                Category = "Kids Friendly"
            }
        };
    }
}
