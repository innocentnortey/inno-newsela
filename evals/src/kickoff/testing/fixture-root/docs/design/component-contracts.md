# Fixture contracts

# Decision table (G-22), first matching row wins:
#   schema_valid and compiled and check_passed   → store
#   repair_rounds < max_repair_rounds            → repair
#   otherwise                                    → fail
# trailing comment line
