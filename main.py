import pandas as pd
import json

URL = "https://docs.google.com/spreadsheets/d/1VMtbKVJyeTvMJe_P69TzRtCdjHsj6i7xPuqImLznj_4/export?format=csv"


def clean(x):
    if pd.isna(x):
        return ""
    return str(x).replace("\n", " ").strip()


def is_doctor(x):
    return "Dr." in x


def detect_category(text):
    text = text.upper()
    if "GENERAL OPD" in text:
        return "General OPD"
    elif "VISITING SPECIALIST" in text:
        return "Visiting Specialist"
    elif "LEAVE" in text:
        return "On Leave"
    return None


def parse_sheet(url):
    df = pd.read_csv(url, header=None)
    doctors = []
    current_category = "Main OPD"

    for i in range(len(df)):
        row = [clean(x) for x in df.iloc[i].tolist()]
        row_text = " ".join(row)

        # Detect section headers
        category = detect_category(row_text)
        if category:
            current_category = category
            continue

        # Find ALL doctor positions in row
        doctor_indices = [idx for idx, cell in enumerate(row) if is_doctor(cell)]

        for idx_num, idx in enumerate(doctor_indices):
            try:
                name = row[idx]
                room = row[idx + 1] if idx + 1 < len(row) else ""
                timing = row[idx + 2] if idx + 2 < len(row) else ""

                shift = "morning" if idx_num == 0 else "afternoon"

                doctors.append({
                    "name": name,
                    "room": room,
                    "timing": timing,
                    "shift": shift,
                    "category": current_category
                })

            except:
                continue

    return doctors


# Run
data = parse_sheet(URL)

# Remove duplicates
unique = {(d["name"], d["shift"], d["timing"]): d for d in data}
final_data = list(unique.values())

print(json.dumps(final_data, indent=4))