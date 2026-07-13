from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import pandas as pd
import json
import os
from models import Customer
from database import db
from models import Customer


# Load Environment Variables
load_dotenv()


# Flask App
app = Flask(__name__)
CORS(app)

# Database Configuration

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

from database import db

db.init_app(app)

# Base Directory
BASE_DIR = os.path.dirname(__file__)


# HOME
@app.route("/")
def home():
    return jsonify({
        "status": "running",
        "project": "Customer Segmentation"
    })


# SEGMENTS
@app.route("/segments")
def segments():

    customers = Customer.query.all()

    data = []

    for c in customers:

        data.append({
            "CustomerID": c.customer_id,
            "Recency": c.recency,
            "Frequency": c.frequency,
            "Monetary": c.monetary,
            "Avg_Order_Value": c.avg_order_value,
            "Cluster": c.cluster,
            "Segment": c.segment
        })

    return jsonify(data)


# METRICS
@app.route("/metrics")
def metrics():

    metrics_file = os.path.join(
        BASE_DIR,
        "models",
        "metrics.json"
    )

    with open(metrics_file, "r") as f:
        data = json.load(f)

    return jsonify(data)


# TOP CUSTOMERS
@app.route("/top-customers")
def top_customers():

    customers = Customer.query.order_by(
        Customer.monetary.desc()
    ).limit(20).all()

    data = []

    for c in customers:

        data.append({
            "CustomerID": c.customer_id,
            "Recency": c.recency,
            "Frequency": c.frequency,
            "Monetary": c.monetary,
            "Avg_Order_Value": c.avg_order_value,
            "Cluster": c.cluster,
            "Segment": c.segment
        })

    return jsonify(data)

# Run App
if __name__ == "__main__":
    app.run(debug=True, port=5000)