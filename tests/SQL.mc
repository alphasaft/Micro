##! SQLike




SELECT age IN table WHERE age = (SELECT (min(age)) IN table)
