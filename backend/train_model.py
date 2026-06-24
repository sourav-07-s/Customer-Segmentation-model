import os
import json
import joblib
import numpy as np
import pandas as pd

from preprocess import preprocess_data

from sklearn.cluster import KMeans
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import silhouette_score


BASE_DIR = os.path.dirname(
    os.path.dirname(__file__)
)

csv_path = os.path.join(
    BASE_DIR,
    "data",
    "customer_segmentation_50000_transactions.csv"
)


# LOAD DATA


df = preprocess_data(csv_path)


# CREATE RFM


print("\nCreating RFM Table...")

snapshot_date = df["Date"].max()

rfm = df.groupby(
    "ACTIVE_CUSTOMER_ID"
).agg({

    "Date": lambda x:
    (snapshot_date - x.max()).days,

    "Transaction ID": "count",

    "Total Amount": "sum"

})

rfm.columns = [
    "Recency",
    "Frequency",
    "Monetary"
]

rfm = rfm.reset_index()

rfm.rename(
    columns={
        "ACTIVE_CUSTOMER_ID":
        "CustomerID"
    },
    inplace=True
)


# FEATURE ENGINEERING


rfm["Avg_Order_Value"] = (
    rfm["Monetary"] /
    rfm["Frequency"]
)


rfm["Frequency"] = np.log1p(
    rfm["Frequency"]
)

rfm["Monetary"] = np.log1p(
    rfm["Monetary"]
)


# SCALING


features = rfm[
    [
        "Recency",
        "Frequency",
        "Monetary",
        "Avg_Order_Value"
    ]
]

scaler = RobustScaler()

scaled_data = scaler.fit_transform(
    features
)


# AUTO CLUSTER SELECTION


best_k = 2
best_score = -1

print("\nFinding Best K...")

for k in range(2, 11):

    model = KMeans(
        n_clusters=k,
        random_state=42,
        n_init=10
    )

    labels = model.fit_predict(
        scaled_data
    )

    score = silhouette_score(
        scaled_data,
        labels
    )

    print(
        f"K={k} "
        f"Silhouette={score:.4f}"
    )

    if score > best_score:

        best_score = score
        best_k = k

print(
    f"\nBest K Selected: {best_k}"
)


# FINAL MODEL


kmeans = KMeans(
    n_clusters=best_k,
    random_state=42,
    n_init=10
)

rfm["Cluster"] = kmeans.fit_predict(
    scaled_data
)


# CLUSTER NAMES


cluster_stats = rfm.groupby(
    "Cluster"
)["Monetary"].mean().sort_values(
    ascending=False
)

segment_names = {}

labels = [
    "VIP Customers",
    "Loyal Customers",
    "Regular Customers",
    "At Risk Customers",
    "Lost Customers",
    "Dormant Customers",
    "New Customers",
    "Potential Loyalists",
    "Champions"
]

for i, cluster in enumerate(
    cluster_stats.index
):

    segment_names[cluster] = (
        labels[i]
        if i < len(labels)
        else f"Segment {cluster}"
    )

rfm["Segment"] = (
    rfm["Cluster"]
    .map(segment_names)
)


# SAVE MODELS


model_dir = os.path.join(
    os.path.dirname(__file__),
    "models"
)

os.makedirs(
    model_dir,
    exist_ok=True
)

joblib.dump(
    kmeans,
    os.path.join(
        model_dir,
        "kmeans_model.pkl"
    )
)

joblib.dump(
    scaler,
    os.path.join(
        model_dir,
        "scaler.pkl"
    )
)


# SAVE CSV


rfm.to_csv(
    os.path.join(
        model_dir,
        "customer_segments.csv"
    ),
    index=False
)


# SAVE METRICS


metrics = {
    "customers":
    int(len(rfm)),

    "best_k":
    int(best_k),

    "silhouette_score":
    float(best_score)
}

with open(
    os.path.join(
        model_dir,
        "metrics.json"
    ),
    "w"
) as f:

    json.dump(
        metrics,
        f,
        indent=4
    )

print("\nTraining Completed")
print(
    f"Customers: {len(rfm)}"
)
print(
    f"Best K: {best_k}"
)
print(
    f"Score: {best_score:.4f}"
)