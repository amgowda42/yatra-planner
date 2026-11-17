try:
    from app.models import PlaceModel
except ModuleNotFoundError:  # allows running the app from the app directory
    from models import PlaceModel

PLACES_DATABASE = {
    "Goa": [
        PlaceModel(
            name="Baga Beach",
            description="A popular beach in Goa known for its nightlife and water sports.",
            category="Beach",
            rating=4.5,
            estimated_visit_duration=120,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Fort Aguada",
            description="A well-preserved 17th-century Portuguese fort overlooking the Arabian Sea.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=90,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Dudhsagar Waterfalls",
            description="A majestic waterfall located on the Mandovi River, surrounded by lush greenery.",
            category="Nature",
            rating=4.7,
            estimated_visit_duration=180,
            entry_fee=10.0,
        ),
        PlaceModel(
            name="Basilica of Bom Jesus",
            description="A UNESCO World Heritage Site and a fine example of baroque architecture.",
            category="Religious Site",
            rating=4.6,
            estimated_visit_duration=60,
            entry_fee=0.0,
        ),
    ],
    "Bangalore": [
        PlaceModel(
            name="Lalbagh Botanical Garden",
            description="A historic botanical garden with a diverse collection of plants and a glasshouse.",
            category="Nature",
            rating=4.5,
            estimated_visit_duration=120,
            entry_fee=15.0,
        ),
        PlaceModel(
            name="Bangalore Palace",
            description="A grand palace built in Tudor-style architecture, inspired by England's Windsor Castle.",
            category="Historical Site",
            rating=4.3,
            estimated_visit_duration=90,
            entry_fee=230.0,
        ),
        PlaceModel(
            name="Cubbon Park",
            description="A large green space in the heart of the city, perfect for walks and picnics.",
            category="Nature",
            rating=4.6,
            estimated_visit_duration=60,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="ISKCON Temple Bangalore",
            description="A beautiful temple dedicated to Lord Krishna, known for its architecture and spiritual ambiance.",
            category="Religious Site",
            rating=4.7,
            estimated_visit_duration=90,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Vidhana Soudha",
            description="An iconic building housing the state legislature of Karnataka, known for its grand architecture.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=30,
            entry_fee=0.0,
        ),
    ],

    "Jaipur": [
        PlaceModel(
            name="Amber Fort",
            description="A majestic fort located on a hilltop, known for its artistic Hindu style elements.",
            category="Historical Site",
            rating=4.6,
            estimated_visit_duration=120,
            entry_fee=100.0,
        ),
        PlaceModel(
            name="City Palace",
            description="A beautiful palace complex that showcases a blend of Rajasthani and Mughal architecture.",
            category="Historical Site",
            rating=4.5,
            estimated_visit_duration=90,
            entry_fee=200.0,
        ),
        PlaceModel(
            name="Hawa Mahal",
            description="An iconic five-story palace with a unique facade, also known as the 'Palace of Winds'.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=30,
            entry_fee=50.0,
        ),
        PlaceModel(
            name="Jantar Mantar",
            description="An astronomical observatory featuring a collection of architectural astronomical instruments.",
            category="Historical Site",
            rating=4.3,
            estimated_visit_duration=60,
            entry_fee=40.0,
        ),
    ],
    "Delhi": [
        PlaceModel(
            name="Red Fort",
            description="A historic fort and UNESCO World Heritage Site, known for its Mughal architecture.",
            category="Historical Site",
            rating=4.5,
            estimated_visit_duration=90,
            entry_fee=35.0,
        ),
        PlaceModel(
            name="India Gate",
            description="A war memorial dedicated to Indian soldiers, surrounded by lush gardens.",
            category="Historical Site",
            rating=4.6,
            estimated_visit_duration=30,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Qutub Minar",
            description="A UNESCO World Heritage Site and the tallest brick minaret in the world.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=60,
            entry_fee=30.0,
        ),
        PlaceModel(
            name="Lotus Temple",
            description="A Bahá'í House of Worship known for its flowerlike shape and serene ambiance.",
            category="Religious Site",
            rating=4.7,
            estimated_visit_duration=45,
            entry_fee=0.0,
        ),
    ],
    "Mumbai": [
        PlaceModel(
            name="Gateway of India",
            description="A iconic arch monument built to commemorate the visit of King George V and Queen Mary to Mumbai.",
            category="Historical Site",
            rating=4.5,
            estimated_visit_duration=60,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Marine Drive",
            description="A scenic promenade along the coast, known for its stunning views of the Arabian Sea.",
            category="Nature",
            rating=4.6,
            estimated_visit_duration=90,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Chhatrapati Shivaji Maharaj Terminus",
            description="A historic railway station and UNESCO World Heritage Site, known for its Victorian Gothic architecture.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=30,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Siddhivinayak Temple",
            description="A famous Hindu temple dedicated to Lord Ganesha, attracting thousands of devotees daily.",
            category="Religious Site",
            rating=4.7,
            estimated_visit_duration=60,
            entry_fee=0.0,
        ),
    ],
    "Kolkata": [
        PlaceModel(
            name="Howrah Bridge",
            description="A historic steel bridge spanning the Hooghly River, known for its distinctive architecture.",
            category="Historical Site",
            rating=4.3,
            estimated_visit_duration=45,
            entry_fee=0.0,
        ),
    ],
    "Chennai": [
        PlaceModel(
            name="Marina Beach",
            description="A popular coastal beach known for its golden sand and vibrant atmosphere.",
            category="Nature",
            rating=4.5,
            estimated_visit_duration=120,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Kapaleeshwarar Temple",
            description="A historic Hindu temple dedicated to Lord Shiva, known for its Dravidian architecture.",
            category="Religious Site",
            rating=4.6,
            estimated_visit_duration=60,
            entry_fee=0.0,
        ),
        PlaceModel(
            name="Fort St. George",
            description="A historic fort built by the British East India Company, now housing the Tamil Nadu legislative assembly.",
            category="Historical Site",
            rating=4.4,
            estimated_visit_duration=90,
            entry_fee=20.0,
        ),
    ]
}

def get_places_for_destination(destination: str) -> list[PlaceModel]:
    """Retrieve a list of places for the given destination."""
    return PLACES_DATABASE.get(destination, [])