from database import db

class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)

    customer_id = db.Column(db.Integer, unique=True, nullable=False)

    recency = db.Column(db.Integer)

    frequency = db.Column(db.Float)

    monetary = db.Column(db.Float)

    avg_order_value = db.Column(db.Float)

    cluster = db.Column(db.Integer)

    segment = db.Column(db.String(100))