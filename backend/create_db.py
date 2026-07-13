from app import app
from database import db
from models import Customer

with app.app_context():
    db.create_all()

print("Database Created")