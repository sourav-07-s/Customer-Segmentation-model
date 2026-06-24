from flask import Flask
from flask import jsonify
from flask_cors import CORS

import pandas as pd
import json
import os

app = Flask(__name__)

CORS(app)

BASE_DIR = os.path.dirname(
    __file__
)

# HOME


@app.route("/")
def home():

    return jsonify({
        "status": "running",
        "project":
        "Customer Segmentation"
    })



# SEGMENTS


@app.route("/segments")
def segments():

    file_path = os.path.join(
        BASE_DIR,
        "models",
        "customer_segments.csv"
    )

    df = pd.read_csv(
        file_path
    )

    return jsonify(
        df.to_dict(
            orient="records"
        )
    )



# METRICS


@app.route("/metrics")
def metrics():

    metrics_file = os.path.join(
        BASE_DIR,
        "models",
        "metrics.json"
    )

    with open(
        metrics_file,
        "r"
    ) as f:

        data = json.load(f)

    return jsonify(data)



# TOP CUSTOMERS


@app.route("/top-customers")
def top_customers():

    file_path = os.path.join(
        BASE_DIR,
        "models",
        "customer_segments.csv"
    )

    df = pd.read_csv(
        file_path
    )

    top = df.sort_values(
        "Monetary",
        ascending=False
    ).head(20)

    return jsonify(
        top.to_dict(
            orient="records"
        )
    )


# RUN


if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000
    )