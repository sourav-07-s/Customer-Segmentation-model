import pandas as pd

from app import app
from database import db
from models import Customer

df = pd.read_csv("../backend/models/customer_segments.csv")

with app.app_context():

    Customer.query.delete()

    for _, row in df.iterrows():

        customer = Customer(

            customer_id=int(row["CustomerID"]),

            recency=int(row["Recency"]),

            frequency=float(row["Frequency"]),

            monetary=float(row["Monetary"]),

            avg_order_value=float(row["Avg_Order_Value"]),

            cluster=int(row["Cluster"]),

            segment=row["Segment"]

        )

        db.session.add(customer)

    db.session.commit()

print("Data Imported Successfully")