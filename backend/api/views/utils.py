"""
Shared geo utilities used by multiple view modules.
"""
import math


def haversine(lat1, lon1, lat2, lon2):
    """Return distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Exact GPS coordinates for the three fixed Help & Delivery pickup points
PICKUP_COORDS = {
    'main_gate':    (19.12845641460189,  72.91926132752846),
    'gulmohar':     (19.129814529274448, 72.91533444403758),
    'shree_balaji': (19.135117507090506, 72.90574766165889),
}

ACCEPT_RADIUS_METRES = 200

# Predefined IITB campus location coordinates — used for GPS → nearest-location resolution (L&F)
LF_LOCATION_COORDS = {
    'main_gate':     (19.12845641460189,  72.91926132752846),
    'gulmohar':      (19.129814529274448, 72.91533444403758),
    'shree_balaji':  (19.135117507090506, 72.90574766165889),
    'central_lib':   (19.13332, 72.91318),
    'lecture_hall':  (19.13260, 72.91182),
    'kresit':        (19.13400, 72.91090),
    'sac':           (19.13100, 72.91550),
    'gymkhana':      (19.13050, 72.91500),
    'main_building': (19.13360, 72.91270),
    'conv_hall':     (19.13220, 72.91050),
    'sjmsom':        (19.13520, 72.90980),
    # Hostel cluster (approximate)
    'hostel_1':   (19.13046, 72.91560), 'hostel_2':   (19.13012, 72.91520),
    'hostel_3':   (19.12988, 72.91490), 'hostel_4':   (19.12960, 72.91460),
    'hostel_5':   (19.12940, 72.91420), 'hostel_6':   (19.12910, 72.91380),
    'hostel_7':   (19.12880, 72.91350), 'hostel_8':   (19.12850, 72.91310),
    'hostel_9':   (19.12820, 72.91280), 'hostel_10':  (19.12790, 72.91250),
    'hostel_11':  (19.13200, 72.91650), 'hostel_12':  (19.13180, 72.91680),
    'hostel_13':  (19.13250, 72.91700), 'hostel_14':  (19.13270, 72.91720),
    'hostel_15':  (19.13290, 72.91740), 'hostel_16':  (19.13310, 72.91760),
    'hostel_17':  (19.13330, 72.91780), 'hostel_18':  (19.13350, 72.91800),
    'hostel_19':  (19.13370, 72.91820), 'hostel_21':  (19.13390, 72.91840),
    'tansa_house': (19.13420, 72.91860),
}
