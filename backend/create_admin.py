import sys
import os

# Add the project root to the Python path to allow imports
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import sessionLocal, engine
import models
from security import get_password_hash

# --- Professional Admin Details ---
# Using a valid email format to satisfy Pydantic/EmailStr validation
NEW_ADMIN_EMAIL = "admin@xcalibr.ai" 
NEW_ADMIN_PASS = "Admin@2026!#" # Stronger password for testing

def create_admin_user():
    db = sessionLocal()
    try:
        # Check if user already exists
        existing_admin = db.query(models.Admin).filter(models.Admin.email == NEW_ADMIN_EMAIL).first()
        if existing_admin:
            print(f"Admin with email '{NEW_ADMIN_EMAIL}' already exists.")
            return

        # Hash the password 
        hashed_password = get_password_hash(NEW_ADMIN_PASS)

        # Create new admin with more realistic data
        new_admin = models.Admin(
            firstname="System",
            lastname="Administrator",
            email=NEW_ADMIN_EMAIL,
            pass_word=hashed_password,
            organization="XCalibr AI",
            permissions="all" # Standardized permission string
        )
        
        db.add(new_admin)
        db.commit()
        
        print("-" * 30)
        print("ADMIN ACCOUNT CREATED SUCCESSFULLY")
        print(f"Email:    {NEW_ADMIN_EMAIL}")
        print(f"Password: {NEW_ADMIN_PASS}")
        print("-" * 30)

    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure tables are created
    models.Base.metadata.create_all(bind=engine)
    create_admin_user()