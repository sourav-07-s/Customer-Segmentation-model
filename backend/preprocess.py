import pandas as pd


def preprocess_data(filepath):

    print("=" * 50)
    print("LOADING DATASET")
    print("=" * 50)

    df = pd.read_csv(filepath)

    print(f"Original Shape: {df.shape}")

    required_columns = [
        "Transaction ID",
        "Date",
        "Customer ID",
        "Quantity",
        "Price per Unit",
        "Total Amount"
    ]

    missing = [
        col for col in required_columns
        if col not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing Columns: {missing}"
        )

    # Remove duplicates
    df = df.drop_duplicates()

    # Convert Date
    df["Date"] = pd.to_datetime(
        df["Date"],
        errors="coerce"
    )

    # Numeric Conversion
    numeric_cols = [
        "Quantity",
        "Price per Unit",
        "Total Amount"
    ]

    for col in numeric_cols:

        df[col] = pd.to_numeric(
            df[col],
            errors="coerce"
        )

    # Missing Values
    df["Quantity"] = df["Quantity"].fillna(
        df["Quantity"].median()
    )

    df["Total Amount"] = df["Total Amount"].fillna(
        df["Total Amount"].median()
    )

    # Remove Invalid Records
    df = df.dropna(
        subset=[
            "Customer ID",
            "Date",
            "Total Amount"
        ]
    )

    df = df[
        df["Total Amount"] > 0
    ]

    # Active Customer ID
    df["ACTIVE_CUSTOMER_ID"] = (
        df["Customer ID"]
    )

    print(f"Cleaned Shape: {df.shape}")
    print(
        f"Unique Customers: "
        f"{df['ACTIVE_CUSTOMER_ID'].nunique()}"
    )

    print("=" * 50)

    return df