
//Pick a year for classification
var year = 2024;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = startDate.advance(1, 'year');

// Create a Sentinel-2 composite for the selected year
// for selecting training samples
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
var filteredS2 = s2
  .filter(ee.Filter.date(startDate, endDate))
  .filter(ee.Filter.bounds(geometry));

// Use the Cloud Score+ collection for cloud masking
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var csPlusBands = csPlus.first().bandNames();
var filteredS2WithCs = filteredS2.linkCollection(csPlus, csPlusBands);

function maskLowQA(image) {
  var qaBand = 'cs';
  var clearThreshold = 0.6;
  var mask = image.select(qaBand).gte(clearThreshold);
  return image.updateMask(mask);
}

var filteredS2Masked = filteredS2WithCs
  .map(maskLowQA)
  .select('B.*');

// Create a median composite of cloud-masked images
var composite = filteredS2Masked.median();
// Display the input composite
var swirVis = {min: 300, max: 4000, bands: ['B11', 'B8', 'B4']};

// Map.centerObject(geometry);
// Map.addLayer(composite.clip(geometry), swirVis, 'S2 Composite (False Color)');

// ============================================================================
// CLASSIFICATION USING SATELLITE EMBEDDINGS
// ============================================================================

// ============================================================================
// CHANGE 1: Load ALL training polygons without class limits
// ============================================================================
// Load training POLYGONS from your asset
// The training data should have a 'Class' column where:
// Class = 1 for Saltmarsh
// Class = any other value for Non-saltmarsh (e.g., 2, 3, 4, etc.)
var trainingPolygons = table;

// ============================================================================
// CHANGE 2: Reclassify to Binary (Saltmarsh vs Non-saltmarsh)
// ============================================================================
// Convert to binary classification:
// Class 1 (Saltmarsh) stays as 1
// All other classes become 0 (Non-saltmarsh)
var trainingPolygonsBinary = trainingPolygons.map(function(feature) {
  var originalClass = feature.get('Class');
  var binaryClass = ee.Algorithms.If(ee.Number(originalClass).eq(1), 1, 0);
  return feature.set('BinaryClass', binaryClass);
});

// Print class distribution
var saltmarshCount = trainingPolygonsBinary.filter(ee.Filter.eq('BinaryClass', 1)).size();
var nonSaltmarshCount = trainingPolygonsBinary.filter(ee.Filter.eq('BinaryClass', 0)).size();
// print('Saltmarsh polygons (Class=1):', saltmarshCount);
// print('Non-saltmarsh polygons (Class=0):', nonSaltmarshCount);

// Load the Satellite Embedding collection
var embeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

var embeddingsFiltered = embeddings
  .filter(ee.Filter.date(startDate, endDate))
  .filter(ee.Filter.bounds(geometry));

var embeddingsImage = embeddingsFiltered.mosaic().clip(geometry);

// ============================================================================
// ELEVATION MASK - Filter areas above 10m
// ============================================================================

// Load SRTM Digital Elevation Model
var srtm = ee.Image('USGS/SRTMGL1_003');
var elevation = srtm.select('elevation');

// Create mask for areas <= 10m elevation
var elevationMask = elevation.lte(10);

// Apply elevation mask to embeddings image
var embeddingsImage = embeddingsImage.updateMask(elevationMask);

// ============================================================================
// CHANGE 3: 80/20 Train-Validation Split
// ============================================================================
// Add a random column for splitting polygons into training (80%) and validation (20%)
var polygonsWithRandom = trainingPolygonsBinary.randomColumn('random', 42); // seed=42 for reproducibility

// Split into 80% training and 20% validation POLYGONS
var trainingPolygons80 = polygonsWithRandom.filter(ee.Filter.lt('random', 0.8));
var validationPolygons20 = polygonsWithRandom.filter(ee.Filter.gte('random', 0.8));

// print('=== TRAIN/VALIDATION SPLIT ===');
// print('Training polygons (80%):', trainingPolygons80.size());
// print('Validation polygons (20%):', validationPolygons20.size());

// ============================================================================
// CHANGE 4: Sample Training Data (80%) - Uses BinaryClass property
// ============================================================================

// Separate saltmarsh and non-saltmarsh polygons
var saltmarshPolygons = trainingPolygons80.filter(ee.Filter.eq('BinaryClass', 1));
var nonSaltmarshPolygons = trainingPolygons80.filter(ee.Filter.eq('BinaryClass', 0));

// This prevents sampling from too many polygons at once
// Limit polygons per class
saltmarshPolygons = saltmarshPolygons.limit(25);
nonSaltmarshPolygons = nonSaltmarshPolygons.limit(60);

var trainingSaltmarsh = embeddingsImage.sampleRegions({
  collection: saltmarshPolygons,
  properties: ['BinaryClass'],
  scale: 10,
  geometries: false,
  tileScale: 16
})

var trainingNonSaltmarsh = embeddingsImage.sampleRegions({
  collection: nonSaltmarshPolygons,
  properties: ['BinaryClass'],
  scale: 10,
  geometries: false,
  tileScale: 16
})

// Merge both classes
var training = trainingSaltmarsh.merge(trainingNonSaltmarsh);

// ============================================================================
// CHANGE 5: Train Binary Classifier (Saltmarsh vs Non-saltmarsh)
// ============================================================================
// Train directly with the limited samples

// Train a KNN classifier
var classifier = ee.Classifier.smileKNN({
  k: 5  // You can adjust the number of neighbors (3-10 typical)
}).train({
  features: training,
  classProperty: 'BinaryClass',  // Binary: 0=Non-saltmarsh, 1=Saltmarsh
  inputProperties: embeddingsImage.bandNames()
});

// ============================================================================
// CHANGE 6: Classify and Extract SALTMARSH ONLY
// ============================================================================

// Classify the image (result: 0=Non-saltmarsh, 1=Saltmarsh)
var classified = embeddingsImage.classify(classifier);

// Create a binary mask showing only saltmarsh (class = 1)
var saltmarshOnly = classified.eq(1);

// Visualization parameters
var classifiedVis = {
  min: 0,
  max: 1,
  palette: ['gray', '00FF00']  // Gray for non-saltmarsh, Green for saltmarsh
};

// Map.addLayer(classified.clip(geometry), {min: 0, max: 1, palette: ['red', 'green']}, 
//   'Classification (Red=Non-saltmarsh, Green=Saltmarsh)', false);
Map.addLayer(saltmarshOnly.selfMask().clip(geometry, 8), {palette: ['00FF00']}, 
  'Saltmarsh Only (Final Output)', true);

// ============================================================================
// CHANGE 7: Accuracy Assessment using Validation Data (20%)
// ============================================================================
// Limit validation polygons too
var validationSaltmarshPolygons = validationPolygons20.filter(ee.Filter.eq('BinaryClass', 1)).limit(6);
var validationNonSaltmarshPolygons = validationPolygons20.filter(ee.Filter.eq('BinaryClass', 0)).limit(12);

// Stratified sampling for validation with aggressive memory settings
var validationSaltmarsh = embeddingsImage.sampleRegions({
  collection: validationSaltmarshPolygons,
  properties: ['BinaryClass'],
  scale: 10,
  geometries: false,
  tileScale: 16  
})

var validationNonSaltmarsh = embeddingsImage.sampleRegions({
  collection: validationNonSaltmarshPolygons,
  properties: ['BinaryClass'],
  scale: 10,
  geometries: false,
  tileScale: 16  
})

// Merge both classes
var validation = validationSaltmarsh.merge(validationNonSaltmarsh);

// Classify the validation samples
var validated = validation.classify(classifier);

// Create confusion matrix
var confusionMatrix = validated.errorMatrix('BinaryClass', 'classification');

// Print accuracy metrics

// print(confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
print('Kappa Coefficient:', confusionMatrix.kappa());
print("Producer's Accuracy (by class):", confusionMatrix.producersAccuracy());
print("Consumer's Accuracy (by class):", confusionMatrix.consumersAccuracy());

// ============================================================================
// 26. SALTMARSH AREA CALCULATION
// ============================================================================

// Calculate total area of saltmarsh (class = 1)
var areaImage = classified.eq(1).multiply(ee.Image.pixelArea());

var stats = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: geometry,
  scale: 50,
  maxPixels: 1e13,
  bestEffort: true
});

var areaSqM = ee.Number(stats.get('classification'));
var areaHectares = areaSqM.divide(10000);
var areaSqKm = areaSqM.divide(1000000);

// print('=== AREA STATISTICS ===');
//print('Saltmarsh Area (hectares):', areaHectares);

// //Export and calculate area in another tool
// Export.image.toDrive({
//   image: saltmarshOnly.clip(geometry),
//   description: 'saltmarsh_area_' + year,
//   scale: 10,
//   region: geometry,
//   maxPixels: 1e13
// });