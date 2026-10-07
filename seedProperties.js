const mongoose = require("mongoose");

// CHANGE THIS to your MongoDB connection string
const MONGODB_URI =
  "mongodb+srv://vedant115619:5mSYsaFTfFDSewS5@cluster0.m0j0ech.mongodb.net/mydatabase?retryWrites=true&w=majority";

const propertySchema = new mongoose.Schema(
  {
    propertyId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    internalName: { type: String, default: "" },

    city: { type: String, required: true },
    area: { type: String, required: true },

    propertyType: { type: String, required: true },
    propertySubType: { type: String, required: true },

    budgetRange: { type: String, required: true },
    price: { type: Number, required: true },

    configuration: { type: String, required: true },
    spaceSize: { type: String, default: null },
    location: { type: String, required: true },
    areaSqft: { type: Number, required: true, default: 1000 },

    dimensions: { type: String, default: "" },
    facing: { type: String, default: "" },
    floor: { type: String, default: "" },

    monthlyRent: { type: Number, default: null },
    securityDeposit: { type: Number, default: null },

    setupType: { type: String, default: "" },
    availableFrom: { type: String, default: "" },

    furnishing: {
      type: String,
      default: "unfurnished",
    },

    tenantPreferences: {
      type: [String],
      enum: ["bachelors", "family", "both"],
      default: [],
    },

    foodPreferences: {
      type: [String],
      enum: ["vegetarian", "non_vegetarian"],
      default: [],
    },

    status: {
      type: String,
      enum: ["pending", "available", "rejected", "sold"],
      default: "available",
    },

    source: { type: String, default: "admin" },

    ownerPhone: { type: String },
    ownerName: { type: String },

    description: { type: String },
    features: [{ type: String }],

    imageUrl: { type: String },
    imagePublicId: { type: String },

    images: [{ url: String, publicId: String }],

    categoryTab: {
      type: String,
      enum: [
        "residential_buy",
        "commercial_buy",
        "residential_rent",
        "commercial_rent",
      ],
      default: null,
    },

    views: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Property = mongoose.model("Property", propertySchema);

const properties = [

  // =====================================================
  // RESIDENTIAL BUY
  // =====================================================

  {
    propertyId: "JAB-RB-1001",
    title: "3 BHK Premium Apartment",
    internalName: "Vijay Nagar 3BHK",
    city: "Jabalpur",
    area: "Vijay Nagar",
    propertyType: "buy",
    propertySubType: "apartment",
    budgetRange: "medium",
    price: 4500000,
    configuration: "3bhk",
    spaceSize: "1350 sqft",
    location: "Vijay Nagar, Jabalpur",
    areaSqft: 1350,
    dimensions: "",
    facing: "East",
    floor: "3rd",
    monthlyRent: null,
    securityDeposit: null,
    setupType: "",
    availableFrom: "",
    furnishing: "semi_furnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543201",
    ownerName: "Rajesh Sharma",

    description:
      "Spacious 3 BHK apartment in a prime residential location.",

    features: [
      "Modular Kitchen",
      "Parking",
      "Children Play Area",
      "Lift",
      "Security",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "residential_buy",

    views: 0,
    inquiries: 0,
  },

  {
    propertyId: "JAB-RB-1002",
    title: "4 BHK Luxury Villa",
    internalName: "Vijay Nagar Luxury Villa",
    city: "Jabalpur",
    area: "Vijay Nagar",
    propertyType: "buy",
    propertySubType: "villa",
    budgetRange: "high",
    price: 8500000,
    configuration: "4bhk",
    spaceSize: "2400 sqft",
    location: "Vijay Nagar, Jabalpur",
    areaSqft: 2400,
    dimensions: "40 x 60",
    facing: "North",
    floor: "Ground + 1",
    monthlyRent: null,
    securityDeposit: null,
    setupType: "",
    availableFrom: "",
    furnishing: "fully_furnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543202",
    ownerName: "Amit Verma",

    description:
      "Luxury independent villa with modern amenities and private parking.",

    features: [
      "Modular Kitchen",
      "Private Parking",
      "Garden",
      "Power Backup",
      "Security",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "residential_buy",

    views: 0,
    inquiries: 0,
  },

  {
    propertyId: "JAB-RB-1003",
    title: "2 BHK Affordable Flat",
    internalName: "Gorakhpur 2BHK",
    city: "Jabalpur",
    area: "Gorakhpur",
    propertyType: "buy",
    propertySubType: "apartment",
    budgetRange: "low",
    price: 2800000,
    configuration: "2bhk",
    spaceSize: "950 sqft",
    location: "Gorakhpur, Jabalpur",
    areaSqft: 950,
    dimensions: "",
    facing: "West",
    floor: "2nd",
    monthlyRent: null,
    securityDeposit: null,
    setupType: "",
    availableFrom: "",
    furnishing: "unfurnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543203",
    ownerName: "Rahul Mishra",

    description:
      "Affordable 2 BHK apartment suitable for a small family.",

    features: [
      "Parking",
      "Lift",
      "Water Supply",
      "Security",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "residential_buy",

    views: 0,
    inquiries: 0,
  },


  // =====================================================
  // COMMERCIAL BUY
  // =====================================================

  {
    propertyId: "JAB-CB-2001",
    title: "Commercial Office Space",
    internalName: "Napier Town Office",
    city: "Jabalpur",
    area: "Napier Town",
    propertyType: "commercial",
    propertySubType: "office",
    budgetRange: "high",
    price: 7500000,
    configuration: "commercial",
    spaceSize: "1800 sqft",
    location: "Napier Town, Jabalpur",
    areaSqft: 1800,
    dimensions: "30 x 60",
    facing: "East",
    floor: "2nd",
    monthlyRent: null,
    securityDeposit: null,
    setupType: "",
    availableFrom: "",
    furnishing: "semi_furnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543204",
    ownerName: "Sanjay Gupta",

    description:
      "Prime commercial office space suitable for corporate offices and professional businesses.",

    features: [
      "Parking",
      "Lift",
      "Power Backup",
      "Reception Area",
      "Conference Room",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "commercial_buy",

    views: 0,
    inquiries: 0,
  },

  {
    propertyId: "JAB-CB-2002",
    title: "Prime Commercial Shop",
    internalName: "Wright Town Shop",
    city: "Jabalpur",
    area: "Wright Town",
    propertyType: "commercial",
    propertySubType: "shop",
    budgetRange: "medium",
    price: 3800000,
    configuration: "commercial",
    spaceSize: "650 sqft",
    location: "Wright Town, Jabalpur",
    areaSqft: 650,
    dimensions: "25 x 26",
    facing: "West",
    floor: "Ground",
    monthlyRent: null,
    securityDeposit: null,
    setupType: "",
    availableFrom: "",
    furnishing: "unfurnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543205",
    ownerName: "Vikas Jain",

    description:
      "Ground floor commercial shop located on a busy main road.",

    features: [
      "Main Road Facing",
      "Parking",
      "High Footfall",
      "Power Backup",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "commercial_buy",

    views: 0,
    inquiries: 0,
  },


  // =====================================================
  // RESIDENTIAL RENT
  // =====================================================

  {
    propertyId: "JAB-RR-3001",
    title: "2 BHK Furnished Apartment",
    internalName: "Napier Town Rental",
    city: "Jabalpur",
    area: "Napier Town",
    propertyType: "rent",
    propertySubType: "apartment",
    budgetRange: "medium",
    price: 18000,
    configuration: "2bhk",
    spaceSize: "1100 sqft",
    location: "Napier Town, Jabalpur",
    areaSqft: 1100,
    dimensions: "",
    facing: "East",
    floor: "2nd",
    monthlyRent: 18000,
    securityDeposit: 36000,
    setupType: "",
    availableFrom: "2026-10-01",
    furnishing: "fully_furnished",

    tenantPreferences: [
      "family",
      "both",
    ],

    foodPreferences: [
      "vegetarian",
      "non_vegetarian",
    ],

    status: "available",
    source: "admin",

    ownerPhone: "9876543206",
    ownerName: "Manoj Patel",

    description:
      "Fully furnished 2 BHK apartment available for family or working professionals.",

    features: [
      "Modular Kitchen",
      "Parking",
      "Lift",
      "Power Backup",
      "Security",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "residential_rent",

    views: 0,
    inquiries: 0,
  },

  {
    propertyId: "JAB-RR-3002",
    title: "3 BHK Independent House",
    internalName: "Gorakhpur Family Rental",
    city: "Jabalpur",
    area: "Gorakhpur",
    propertyType: "rent",
    propertySubType: "villa",
    budgetRange: "medium",
    price: 25000,
    configuration: "3bhk",
    spaceSize: "1800 sqft",
    location: "Gorakhpur, Jabalpur",
    areaSqft: 1800,
    dimensions: "30 x 60",
    facing: "North",
    floor: "Ground",
    monthlyRent: 25000,
    securityDeposit: 50000,
    setupType: "",
    availableFrom: "2026-10-15",
    furnishing: "semi_furnished",

    tenantPreferences: [
      "family",
    ],

    foodPreferences: [
      "vegetarian",
      "non_vegetarian",
    ],

    status: "available",
    source: "admin",

    ownerPhone: "9876543207",
    ownerName: "Rakesh Singh",

    description:
      "Independent 3 BHK house suitable for a family.",

    features: [
      "Parking",
      "Garden",
      "Modular Kitchen",
      "Water Supply",
      "Security",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "residential_rent",

    views: 0,
    inquiries: 0,
  },


  // =====================================================
  // COMMERCIAL RENT
  // =====================================================

  {
    propertyId: "JAB-CR-4001",
    title: "Fully Furnished Commercial Office",
    internalName: "Madan Mahal Office",
    city: "Jabalpur",
    area: "Madan Mahal",
    propertyType: "commercial",
    propertySubType: "office",
    budgetRange: "high",
    price: 45000,
    configuration: "commercial",
    spaceSize: "2200 sqft",
    location: "Madan Mahal, Jabalpur",
    areaSqft: 2200,
    dimensions: "40 x 55",
    facing: "East",
    floor: "3rd",
    monthlyRent: 45000,
    securityDeposit: 90000,
    setupType: "office",
    availableFrom: "2026-10-01",
    furnishing: "fully_furnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543208",
    ownerName: "Deepak Agrawal",

    description:
      "Fully furnished office space suitable for IT companies, consultancies and startups.",

    features: [
      "Reception",
      "Conference Room",
      "Cabins",
      "Parking",
      "Lift",
      "Power Backup",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "commercial_rent",

    views: 0,
    inquiries: 0,
  },

  {
    propertyId: "JAB-CR-4002",
    title: "Main Road Commercial Shop",
    internalName: "Civic Centre Shop",
    city: "Jabalpur",
    area: "Civic Centre",
    propertyType: "commercial",
    propertySubType: "shop",
    budgetRange: "medium",
    price: 30000,
    configuration: "commercial",
    spaceSize: "800 sqft",
    location: "Civic Centre, Jabalpur",
    areaSqft: 800,
    dimensions: "20 x 40",
    facing: "North",
    floor: "Ground",
    monthlyRent: 30000,
    securityDeposit: 60000,
    setupType: "retail",
    availableFrom: "2026-10-01",
    furnishing: "unfurnished",

    tenantPreferences: [],
    foodPreferences: [],

    status: "available",
    source: "admin",

    ownerPhone: "9876543209",
    ownerName: "Ankit Tiwari",

    description:
      "Ground floor commercial shop in a high-footfall market area.",

    features: [
      "Main Road Facing",
      "High Footfall",
      "Parking",
      "Power Backup",
      "Water Supply",
    ],

    imageUrl: "",
    imagePublicId: "",
    images: [],

    categoryTab: "commercial_rent",

    views: 0,
    inquiries: 0,
  },
];


// =====================================================
// INSERT DATA
// =====================================================

async function seedProperties() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("MongoDB connected");

    // Optional:
    // Delete old test properties having our test ID prefixes
    await Property.deleteMany({
      propertyId: {
        $regex: /^JAB-(RB|CB|RR|CR)-/,
      },
    });

    const inserted = await Property.insertMany(properties);

    console.log(
      `Successfully inserted ${inserted.length} properties`
    );

    console.log("\nCategory summary:");

    console.log(
      "Residential Buy:",
      inserted.filter(
        (p) => p.categoryTab === "residential_buy"
      ).length
    );

    console.log(
      "Commercial Buy:",
      inserted.filter(
        (p) => p.categoryTab === "commercial_buy"
      ).length
    );

    console.log(
      "Residential Rent:",
      inserted.filter(
        (p) => p.categoryTab === "residential_rent"
      ).length
    );

    console.log(
      "Commercial Rent:",
      inserted.filter(
        (p) => p.categoryTab === "commercial_rent"
      ).length
    );

    await mongoose.disconnect();

    console.log("\nDone!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seedProperties();