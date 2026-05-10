import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import sessionLocal
import models
from security import get_password_hash

def create_hr():
    db = sessionLocal()
    email = "hr@xcalibr.ai"
    password = "password123" # Simple password for testing
    
    try:
        # Clean up any failed attempts first
        db.query(models.Hr).filter(models.Hr.email == email).delete()
        
        new_hr = models.Hr(
            firstname="HR",
            lastname="Manager",
            email=email,
            pass_word=get_password_hash(password),
            designation="Recruiter",
            permissions="all",
            is_active=True
        )
        db.add(new_hr)
        db.commit()
        print(f"SUCCESS!")
        print(f"Email: {email}")
        print(f"Password: {password}")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_hr()