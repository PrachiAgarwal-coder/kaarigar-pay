// Standard-practice templates per business category.
// These are typical industry norms used as the AI's starting point; every contract is editable
// and both parties must sign. Not legal advice.

export type CategoryTemplate = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  typicalPayment: string; // human summary of the usual split
  milestones: { name: string; percent: number; evidence: string[] }[];
  inspection: string;
  qualityStandards: string[];
  incoterm: string;
  returnsAndDefects: string;
  notes: string[]; // extra standard-practice points the AI should apply
  example: string; // demo deal text
};

export const CATEGORIES: CategoryTemplate[] = [
  {
    id: "handicrafts",
    name: "Handicrafts & Jewellery",
    icon: "💍",
    tagline: "Artisan goods, small batches, made to order",
    typicalPayment: "30% on materials · 50% on finished goods · 20% on shipment",
    milestones: [
      { name: "Raw materials purchased", percent: 30, evidence: ["Photo of materials", "Supplier invoice"] },
      { name: "All units finished", percent: 50, evidence: ["Flat-lay photo of every unit", "Close-up next to a ruler"] },
      { name: "Shipped", percent: 20, evidence: ["Packed parcel with airway bill / tracking label"] },
    ],
    inspection: "Photo inspection of 100% of units (small batch)",
    qualityStandards: ["BIS hallmark if gold/silver purity is claimed", "Material declaration (base metal, plating, stones)"],
    incoterm: "DAP (courier, door delivery)",
    returnsAndDefects: "Defects reported with photos within 7 days of delivery",
    notes: ["Handmade variation is normal: allow small tolerances on size and colour", "Reference photo of the approved sample is part of the spec"],
    example: `Seller: Meera Handicrafts, Jaipur, India. Buyer: Olivia Brooks, Austin, USA.
Order: 20 pairs of handmade kundan jhumka earrings, 22k gold-plated brass, red meenakari enamel on the back,
3 kundan stones per earring, drop length 5 cm. Price ₹3,800 per pair, total ₹76,000.
Payment: 30% when raw materials are bought, 50% when all 20 pairs are finished, 20% when shipped with tracking.
Delivery in 3 weeks.`,
  },
  {
    id: "textiles",
    name: "Textiles & Apparel",
    icon: "👕",
    tagline: "Garments, fabrics, home textiles",
    typicalPayment: "30% advance · 70% after pre-shipment inspection and shipping documents",
    milestones: [
      { name: "Fabric & trims approved", percent: 30, evidence: ["Fabric swatch photo with colour reference", "Mill invoice"] },
      { name: "Pre-shipment inspection passed", percent: 50, evidence: ["Inspection report", "Photos of packed cartons with size breakdown"] },
      { name: "Shipped", percent: 20, evidence: ["Bill of lading / airway bill"] },
    ],
    inspection: "Pre-shipment AQL inspection (ISO 2859-1, AQL 2.5 major / 4.0 minor)",
    qualityStandards: ["Measurement spec per size with ± tolerance", "OEKO-TEX / GOTS only if claimed"],
    incoterm: "FOB (port of loading)",
    returnsAndDefects: "Claims above the agreed AQL raised within 14 days of arrival",
    notes: ["Colour matched against approved lab dip", "Size-wise quantity breakdown is part of the spec"],
    example: `Seller: Tirupur Knit Works, Tirupur, India. Buyer: Northwind Apparel, Berlin, Germany.
Order: 1,200 organic cotton crew-neck T-shirts, 180 GSM, navy (Pantone 19-4024), sizes S/M/L/XL in 2:4:4:2 ratio.
Price ₹310 per piece, total ₹3,72,000. Payment 30% advance after fabric approval, 70% after inspection and shipping.
Ship FOB Chennai in 6 weeks.`,
  },
  {
    id: "manufacturing",
    name: "Custom Manufacturing",
    icon: "⚙️",
    tagline: "Machined parts, castings, components to drawing",
    typicalPayment: "20% on sample approval · 60% on production + inspection · 20% on shipment",
    milestones: [
      { name: "First article approved", percent: 20, evidence: ["Photo of first-article sample", "Dimensional report vs drawing"] },
      { name: "Production complete & inspected", percent: 60, evidence: ["Photo of full lot", "Inspection report with measured dimensions"] },
      { name: "Shipped", percent: 20, evidence: ["Packed crates photo", "Bill of lading / airway bill"] },
    ],
    inspection: "First-article inspection + sampling inspection of the lot against the drawing",
    qualityStandards: ["Dimensions per drawing; general tolerances ISO 2768-m unless stated", "Material test certificate"],
    incoterm: "FOB / EXW",
    returnsAndDefects: "Non-conforming parts replaced or credited; claims within 30 days",
    notes: ["Drawing revision number is part of the contract", "Surface finish and material grade must be stated"],
    example: `Seller: Precision Engg Works, Rajkot, India. Buyer: Halvorsen Pumps, Oslo, Norway.
Order: 500 stainless steel SS304 pump shafts per drawing HP-221 rev C, length 240 mm ±0.05 mm, diameter 25 mm h7.
Price ₹1,450 each, total ₹7,25,000. 20% after first-article approval, 60% after production inspection, 20% on shipment.`,
  },
  {
    id: "furniture",
    name: "Furniture & Home Décor",
    icon: "🪑",
    tagline: "Wooden furniture, décor, lighting",
    typicalPayment: "40% on materials · 40% on finished goods · 20% on shipment",
    milestones: [
      { name: "Timber procured & seasoned", percent: 40, evidence: ["Photo of timber stock", "Moisture meter reading photo"] },
      { name: "Finished & packed", percent: 40, evidence: ["Photo of each finished piece", "Packed export cartons"] },
      { name: "Shipped", percent: 20, evidence: ["Bill of lading", "Fumigation certificate"] },
    ],
    inspection: "Visual + dimensional check of every piece before packing",
    qualityStandards: ["Kiln-dried timber, moisture content typically 8–12%", "ISPM-15 treated wooden packaging"],
    incoterm: "FOB / CIF",
    returnsAndDefects: "Transit damage reported with photos within 7 days",
    notes: ["Finish/colour matched to approved sample", "Dimensions in cm with ± tolerance"],
    example: `Seller: Jodhpur Woodcraft, Jodhpur, India. Buyer: Casa Verde Interiors, Milan, Italy.
Order: 12 sheesham wood dining chairs, honey finish, seat height 46 cm, with cane back.
Price ₹9,500 each, total ₹1,14,000. 40% on timber, 40% on finished goods, 20% on shipment.`,
  },
  {
    id: "food",
    name: "Food, Spices & Agri",
    icon: "🌶️",
    tagline: "Spices, tea, grains, processed food",
    typicalPayment: "20% on lab-approved sample · 60% on loading · 20% on shipping documents",
    milestones: [
      { name: "Sample & lab report approved", percent: 20, evidence: ["Lab certificate of analysis", "Photo of sample"] },
      { name: "Goods packed & loaded", percent: 60, evidence: ["Photo of labelled bags/cartons with batch numbers", "Loading photo"] },
      { name: "Shipping documents", percent: 20, evidence: ["Phytosanitary certificate", "Bill of lading", "Certificate of origin"] },
    ],
    inspection: "Lab analysis (moisture, purity, pesticide residue) on a representative sample",
    qualityStandards: ["FSSAI licence", "Pesticide residue within destination MRLs", "Phytosanitary certificate"],
    incoterm: "FOB / CIF",
    returnsAndDefects: "Quality claims backed by an independent lab report within 21 days of arrival",
    notes: ["Batch / lot numbers on every bag", "Shelf life and packing date stated"],
    example: `Seller: Malabar Spice Traders, Kochi, India. Buyer: Golden Mortar Foods, Toronto, Canada.
Order: 2,000 kg whole black pepper, 550 g/l bulk density, moisture max 12%, packed in 25 kg PP bags.
Price ₹620 per kg, total ₹12,40,000. 20% on lab-approved sample, 60% on loading, 20% on shipping documents.`,
  },
  {
    id: "electronics",
    name: "Electronics & Assembly",
    icon: "🔌",
    tagline: "PCBs, devices, cable assemblies",
    typicalPayment: "30% on components · 50% on assembly + test · 20% on shipment",
    milestones: [
      { name: "Components procured", percent: 30, evidence: ["Photo of reels/components with labels", "Distributor invoice"] },
      { name: "Assembled & tested", percent: 50, evidence: ["Photo of assembled lot", "Functional test report"] },
      { name: "Shipped", percent: 20, evidence: ["ESD packing photo", "Airway bill"] },
    ],
    inspection: "100% functional test; visual inspection to IPC-A-610 Class 2",
    qualityStandards: ["RoHS compliance", "CE / FCC marking as required by destination"],
    incoterm: "FCA / EXW",
    returnsAndDefects: "Dead-on-arrival units replaced; warranty 12 months",
    notes: ["BOM revision is part of the contract", "Genuine components from authorised distributors"],
    example: `Seller: Pune Circuit Labs, Pune, India. Buyer: Lumen IoT, Austin, USA.
Order: 300 assembled LoRa sensor boards per BOM v2.1, 100% functionally tested, ESD packed.
Price ₹2,100 per board, total ₹6,30,000. 30% on components, 50% after assembly and test, 20% on shipment.`,
  },
  {
    id: "printing",
    name: "Printing & Packaging",
    icon: "📦",
    tagline: "Boxes, labels, printed material",
    typicalPayment: "30% on proof approval · 50% on print run · 20% on dispatch",
    milestones: [
      { name: "Proof approved", percent: 30, evidence: ["Photo of physical proof next to approved artwork"] },
      { name: "Print run complete", percent: 50, evidence: ["Photo of stacked finished units", "Close-up of print quality"] },
      { name: "Dispatched", percent: 20, evidence: ["Packed cartons with tracking label"] },
    ],
    inspection: "Colour checked against approved proof; random sampling of the run",
    qualityStandards: ["Colour within ΔE ≤ 3 of approved proof", "Stock (GSM/board) as specified"],
    incoterm: "DAP / FOB",
    returnsAndDefects: "Misprints above 2% of quantity reprinted",
    notes: ["Approved artwork file version is part of the contract", "Overrun/underrun tolerance usually ±5%"],
    example: `Seller: Sivakasi Print House, Sivakasi, India. Buyer: Bloom Tea Co., London, UK.
Order: 5,000 rigid gift boxes, 350 GSM board, 4-colour print + gold foil logo, 12×12×8 cm.
Price ₹38 per box, total ₹1,90,000. 30% on proof approval, 50% after print run, 20% on dispatch.`,
  },
  {
    id: "services",
    name: "Software & Digital Services",
    icon: "💻",
    tagline: "Apps, websites, design, freelance work",
    typicalPayment: "25% on design approval · 50% on working build · 25% on acceptance & handover",
    milestones: [
      { name: "Design approved", percent: 25, evidence: ["Screenshots of approved designs"] },
      { name: "Working build delivered", percent: 50, evidence: ["Screenshots of the running app/site", "Test report"] },
      { name: "Accepted & handed over", percent: 25, evidence: ["Screenshot of repository/admin handover", "Acceptance sign-off"] },
    ],
    inspection: "Acceptance testing by the buyer within an agreed window (typically 7 days)",
    qualityStandards: ["Features as per agreed scope document", "Source code and IP transfer on final payment"],
    incoterm: "Not applicable (digital delivery)",
    returnsAndDefects: "Bugs found within 30 days of handover fixed at no cost",
    notes: ["Scope changes require a written change order", "Evidence is usually screenshots, so authenticity checks matter"],
    example: `Seller: Prachi Studio, Bengaluru, India. Buyer: Harbor Coffee, Seattle, USA.
Order: a mobile-friendly ordering website with menu, cart and pickup scheduling, admin panel for orders.
Price ₹1,60,000. 25% on design approval, 50% on working build, 25% after acceptance and code handover.`,
  },
];

export const getCategory = (id?: string) => CATEGORIES.find((c) => c.id === id);
