// 1. DEFINE REGION OF INTEREST (ROI)
var roi = geometry

// Center the map on ROI
Map.centerObject(roi, 8);
Map.addLayer(roi, {color: 'green'}, 'ROI', false);

// ============================================================================
// 2. DATE RANGE
// ============================================================================
// var startDate = '2024-01-01';
// var endDate = '2024-12-31';

// // ============================================================================
// // 3. ELEVATION MASK (Remove areas above 10m)
// // ============================================================================
// var dem = ee.Image('USGS/SRTMGL1_003');
// var elevationMask = dem.lte(10); // Areas at or below 10m elevation

// // ============================================================================
// // 4. CLOUD MASKING FUNCTION FOR SENTINEL-2 (USING SCL)
// // ============================================================================
// /**
// * Function to mask clouds and cloud shadows using the SCL band.
// * @param {ee.Image} image Sentinel-2 L2A (Surface Reflectance) image.
// * @return {ee.Image} Masked image.
// */
// function maskS2SrClouds(image) {
//   var scl = image.select('SCL');
  
//   //SCL classes to mask (remove):
//   //3: Cloud Shadow
//   //8: Cloud Medium Probability
//   //9: Cloud High Probability
//   //10: Cirrus
  
//   // Create a mask for shadows
//   var shadowMask = scl.eq(3).not(); // Keep pixels NOT equal to 3
  
//   // Create a mask for clouds
//   var cloudMask = scl.eq(8).not()   // Keep pixels NOT equal to 8
//                     .and(scl.eq(9).not()) // AND NOT equal to 9
//                     .and(scl.eq(10).not()); // AND NOT equal to 10

//   // Combine masks: keep pixels that are NOT shadows AND NOT clouds
//   var finalMask = shadowMask.and(cloudMask);
  
//   return image.updateMask(finalMask)
//       .divide(10000) // Scale reflectance values
//       .copyProperties(image, ["system:time_start"]); // Preserve metadata
// }


// // // ============================================================================
// // // 5. SPECTRAL INDICES FUNCTIONS
// // // ============================================================================

// //NDVI: Normalized Difference Vegetation Index
// function addNDVI(image) {
//   var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
//   return image.addBands(ndvi);
// }

// // EVI: Enhanced Vegetation Index
// function addEVI(image) {
//   var evi = image.expression(
//     'G * ((NIR - RED) / (NIR + C1 * RED - C2 * BLUE + L))', {
//       'NIR': image.select('B8'),
//       'RED': image.select('B4'),
//       'BLUE': image.select('B2'),
//       'G': 2.5,
//       'C1': 6,
//       'C2': 7.5,
//       'L': 1
//     }).rename('EVI');
//   return image.addBands(evi);
// }

// // AWEI: Automated Water Extraction Index
// function addAWEI(image) {
//   var awei = image.expression(
//     '4 * ((GREEN - SWIR) / (0.25 * NIR + 2.75 * SWIR))', {
//       'GREEN': image.select('B3'),
//       'NIR': image.select('B8'),
//       'SWIR': image.select('B11')
//     }).rename('AWEI');
//   return image.addBands(awei);
// }

// // Add all spectral indices
// function addSpectralIndices(image) {
//   return addAWEI(addEVI(addNDVI(image)));
// }

// // ============================================================================
// // 6. LOAD AND PROCESS SENTINEL-2 DATA
// // ============================================================================
// var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
//   .filterBounds(roi)
//   .filterDate(startDate, endDate)
//   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
//   .map(maskS2SrClouds)
//   .map(addSpectralIndices);
  
// // //print('Sentinel-2 Image Count:', s2.size());

// // ============================================================================
// // 7. CREATE OPTICAL COMPOSITE WITH MULTIPLE STATISTICS
// // ============================================================================
// Following methodology: median, 10th, 25th, 75th, 90th percentiles, 
// standard deviation, and interval means (5-95, 10-90, 25-75)
// Applied to NDVI, EVI, AWEI, and NIR band = 36 covariates

//var opticalBands = ['NDVI', 'EVI', 'AWEI', 'B8']; // NIR band included

// Calculate statistics separately to avoid duplicate output names
// var median = s2.select(opticalBands).median();
// var percentiles = s2.select(opticalBands).reduce(ee.Reducer.percentile([10, 25, 75, 90]));
// var stdDev = s2.select(opticalBands).reduce(ee.Reducer.stdDev());
// var intervalMean_5_95 = s2.select(opticalBands).reduce(ee.Reducer.intervalMean(5, 95));
// var intervalMean_10_90 = s2.select(opticalBands).reduce(ee.Reducer.intervalMean(10, 90));
// var intervalMean_25_75 = s2.select(opticalBands).reduce(ee.Reducer.intervalMean(25, 75));

// Rename bands systematically
// var bandNames = [];
// opticalBands.forEach(function(band) {
//   bandNames.push(band + '_median');
//   bandNames.push(band + '_p10');
//   bandNames.push(band + '_p25');
//   bandNames.push(band + '_p75');
//   bandNames.push(band + '_p90');
//   bandNames.push(band + '_stdDev');
//   bandNames.push(band + '_mean_5_95');
//   bandNames.push(band + '_mean_10_90');
//   bandNames.push(band + '_mean_25_75');
// });

// Combine all statistics
// var opticalComposite = median
//   .addBands(percentiles)
//   .addBands(stdDev)
//   .addBands(intervalMean_5_95)
//   .addBands(intervalMean_10_90)
//   .addBands(intervalMean_25_75)
//   .rename(bandNames);

// //print('Optical Composite Bands:', opticalComposite.bandNames());

//============================================================================
// 8. RADAR INDICES FUNCTIONS (SENTINEL-1)
// ============================================================================
// function addRadarIndices(image) {
//   var vv = image.select('VV');
//   var vh = image.select('VH');
  
//   // Span = |S_VV|^2 + |S_VH|^2
//   var span = vv.add(vh).rename('Span');
  
//   // Difference = |S_VV|^2 - |S_VH|^2
//   var difference = vv.subtract(vh).rename('Difference');
  
//   // Ratio = |S_VV|^2 / |S_VH|^2
//   var ratio = vv.divide(vh).rename('Ratio');
  
//   return image.addBands(span).addBands(difference).addBands(ratio);
// }

// ============================================================================
// 9. LOAD AND PROCESS SENTINEL-1 DATA
// ============================================================================
// var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
//   .filterBounds(roi)
//   .filterDate(startDate, endDate)
//   .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
//   .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
//   .filter(ee.Filter.eq('instrumentMode', 'IW'))
//   .map(addRadarIndices);

// //print('Sentinel-1 Image Count:', s1.size());

// // Create radar composite (median of all bands) 5 covariates
// var radarBands = ['VV', 'VH', 'Span', 'Difference', 'Ratio'];
// var radarComposite = s1.select(radarBands).median().rename(
//   radarBands.map(function(b) { return b + '_median'; })
// );

//print('Radar Composite Bands:', radarComposite.bandNames());

// ============================================================================
// 10. COMBINE OPTICAL AND RADAR DATA
// ============================================================================
// var combinedComposite = opticalComposite.addBands(radarComposite);

//Apply elevation mask and clip to ROI to reduce data volume
// combinedComposite = combinedComposite.updateMask(elevationMask).clip(roi).toFloat();

//print('Combined Composite Bands:', combinedComposite.bandNames());
//print('Total number of covariates:', combinedComposite.bandNames().size());

// // ============================================================================
// // 12. EXPORT TO ASSET
// // ============================================================================
// Export.image.toAsset({
//   image: combinedComposite,
//   description: 'SriLanka_combined_Composite_2024',
//   assetId: 'SriLanka_combined_Composite_2024',
//   region: roi,
//   scale: 10,
//   maxPixels: 1e13
// });

//Map.addLayer(combinedcomposite)
//var combinedComposite = (combinedcomposite)

// ============================================================================
// 11. OBJECT-BASED IMAGE SEGMENTATION (SNIC)
// ============================================================================
// Simple Non-Iterative Clustering (SNIC) for object-based classification
// This groups homogenous pixels and converts pixel values within each cluster 
// to the mean value across the cluster, reducing false positives

// Use subset of bands for segmentation to reduce memory, then apply to all bands
// var snicBands = combinedComposite.select([
//   'NDVI_median', 'EVI_median', 'AWEI_median', 'B8_median',
//   'VV_median', 'VH_median', 'Span_median', 'Difference_median', 'Ratio_median'
// ]);

// var seeds = ee.Algorithms.Image.Segmentation.seedGrid(15); // Increased from 10 to 15

// var snic = ee.Algorithms.Image.Segmentation.SNIC({
//   image: snicBands,
//   size: 15,
//   compactness: 5,
//   connectivity: 8, // Reduced from 8
//   neighborhoodSize: 256, // Reduced from 256
//   seeds: seeds
// });

// var clusters = snic.select('clusters');
//Map.addLayer(clusters.randomVisualizer(), {}, 'SNIC Clusters', false);

//12. EXPORT TO ASSET
// ============================================================================
// Export.image.toAsset({
//   image: clusters,
//   description: 'SriLanka_Snic_Clusters',
//   assetId: 'SriLanka_Snic_Clusters',
//   region: roi,
//   scale: 10,
//   maxPixels: 1e13
// });

// Add clusters band to the combined composite
//var objectComposite = combinedComposite.addBands(clusters);

// Compute cluster means for ALL bands at once (no batching)
// var objectBasedComposite = objectComposite.reduceConnectedComponents({
//   reducer: ee.Reducer.mean(),
//   labelBand: 'clusters',
//   maxSize: 256
// });

//12. EXPORT TO ASSET
// ============================================================================
// Export.image.toAsset({
//   image: objectBasedComposite,
//   description: 'SriLanka_Object_based_Composite',
//   assetId: 'SriLanka_Object_based_Composite',
//   region: roi,
//   scale: 10,
//   maxPixels: 1e13
// });


// --- STEP 1: DATA SPLITTING ---')=====

// Add random column for splitting (seed ensures reproducibility)
var dataWithRandom = trainingPolygons.randomColumn({
  columnName: 'random',
  seed: 42
});

// Reclassify into binary: 1 = Saltmarsh, 0 = Non-Saltmarsh
var binaryData = dataWithRandom.map(function(feature) {
  var landcover = feature.get('Class'); 
  var binaryClass = ee.Number(landcover).eq(1).toInt();
  return feature.set('binary_class', binaryClass);
});

// Split data: 70% training, 30% validation
var trainingSet = binaryData.filter(ee.Filter.lt('random', 0.7));
var validationSet = binaryData.filter(ee.Filter.gte('random', 0.7));

// ============================================================================
// STEP 2: SAMPLE PIXELS FROM COMPOSITE
// ============================================================================
// Extract pixel values from the object-based composite at polygon locations

var inputBands = objectBasedComposite.bandNames();

// Sample training pixels
var trainingSamples = objectBasedComposite.sampleRegions({
  collection: trainingSet,
  properties: ['binary_class'],
  scale: 15,
  tileScale: 3,
  geometries: false
});

// Sample validation pixels
var validationSamples = objectBasedComposite.sampleRegions({
  collection: validationSet,
  properties: ['binary_class'],
  scale: 15, //reduced from 10
  tileScale: 3, //reduced from 4
  geometries: false
});

//print('Training samples per class:', trainingSamples.aggregate_histogram('binary_class'));
// STEP 3: TRAIN CLASSIFIER
// ============================================================================
// Train Random Forest on the training set only

//print('\n--- STEP 3: TRAINING CLASSIFIER ---');

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,
  variablesPerSplit: null, // sqrt of number of variables
  minLeafPopulation: 5,
  bagFraction: 0.5,
  maxNodes: null,
  seed: 42
}).train({
  features: trainingSamples,
  classProperty: 'binary_class',
  inputProperties: inputBands
});

// // Check 1: Class balance
// print('Training samples per class:', trainingSamples.aggregate_histogram('binary_class'));

// // Check 2: Sample count
// print('Total training samples:', trainingSamples.size());
// print('Total validation samples:', validationSamples.size());


// ============================================================================
  
// ============================================================================
// 16. OBJECT-BASED CLASSIFICATION
// ============================================================================
// Classify using the object-based composite where all pixels within a cluster
// will receive the same classification (superior predictive power vs pixel-based)

// Already clipped to ROI in Step 10, so use directly
// Classify the object-based image
var classified = objectBasedComposite.classify(classifier);

// Get classification probabilities
var probability = objectBasedComposite.classify(classifier.setOutputMode('PROBABILITY'));

// Visualize initial classification
//Map.addLayer(classified, {min: 0, max: 1, palette: ['gray', 'green']}, 
  //'Object-Based Classification (0=Non-Marsh, 1=Marsh)', false);

//Map.addLayer(probability, {min: 0, max: 1, palette: ['white', 'blue', 'green']}, 
  //'Tidal Marsh Probability (Object-Based)', false);
  
// ============================================================================
// 16. POST-PROCESSING AND REFINEMENT
// ============================================================================

// Remove areas with low probability (<70%)
// Note: Elevation masking was already applied before segmentation
var probabilityThreshold = 0.8;
var refinedClassification = classified.updateMask(probability.gte(probabilityThreshold));

//print('Applied probability threshold: >= ' + probabilityThreshold);
//print('Note: Elevation threshold (<=10m) was applied in Step 3');

// ============================================================================
// 17. FINAL OUTPUT - OBJECT-BASED TIDAL MARSH CLASSIFICATION
// ============================================================================

// Visualize refined classification
Map.addLayer(refinedClassification, 
  {min: 0, max: 1, palette: ['gray', 'red']},
  'Final Tidal Marsh Classification (Object-Based)');

// ============================================================================
// 18. ACCURACY ASSESSMENT - VALIDATION
// ============================================================================

// Classify the validation samples using the trained classifier
var validationClassified = validationSamples.classify(classifier);

// // Check 3: Predicted vs actual distribution
// print('Predicted saltmarsh pixels:', validationClassified.filter(ee.Filter.eq('classification', 1)).size());
// print('Actual saltmarsh pixels:', validationClassified.filter(ee.Filter.eq('binary_class', 1)).size());
// ============================================================================
// 19. CONFUSION MATRIX AND ACCURACY METRICS
// ============================================================================

var errorMatrix = validationClassified.errorMatrix('binary_class', 'classification');

// ============================================================================
// 20. OVERALL ACCURACY
// ============================================================================
var overallAccuracy = errorMatrix.accuracy();

// ============================================================================
// 21. PRODUCER'S ACCURACY (RECALL / SENSITIVITY)
// ============================================================================
var producersAccuracy = errorMatrix.producersAccuracy();

// ============================================================================
// 22. CONSUMER'S ACCURACY (PRECISION / RELIABILITY)
// ============================================================================
var consumersAccuracy = errorMatrix.consumersAccuracy();

// ===============================================================
// 23. KAPPA COEFFICIENT
// ============================================================================
var kappa = errorMatrix.kappa();

// ============================================================================
// 24. EXTRACT INDIVIDUAL CLASS ACCURACIES SAFELY
// ============================================================================
// Get the confusion matrix as a 2D array
var confusionArray = errorMatrix.array();

// Calculate accuracies manually from the confusion matrix
// For binary classification: [[TN, FP], [FN, TP]]
// Class 0 = Non-Marsh, Class 1 = Saltmarsh

var TN = confusionArray.get([0, 0]);  // True Negatives
var FP = confusionArray.get([0, 1]);  // False Positives
var FN = confusionArray.get([1, 0]);  // False Negatives
var TP = confusionArray.get([1, 1]);  // True Positives

// Producer's Accuracy = Recall = Sensitivity
var PA_nonMarsh = ee.Number(TN).divide(ee.Number(TN).add(FP));  // TN / (TN + FP)
var PA_marsh = ee.Number(TP).divide(ee.Number(TP).add(FN));     // TP / (TP + FN)

// Consumer's Accuracy = Precision
var CA_nonMarsh = ee.Number(TN).divide(ee.Number(TN).add(FN));  // TN / (TN + FN)
var CA_marsh = ee.Number(TP).divide(ee.Number(TP).add(FP));     // TP / (TP + FP)

// ============================================================================
// 25. F1 SCORE FOR SALTMARSH CLASS
// ============================================================================
var f1_marsh = ee.Number(2).multiply(PA_marsh).multiply(CA_marsh)
  .divide(ee.Number(PA_marsh).add(CA_marsh));

// ============================================================================
// 26. SALTMARSH AREA CALCULATION
// ============================================================================

// Calculate total area of saltmarsh (class = 1)
var areaImage = refinedClassification.eq(1).multiply(ee.Image.pixelArea());

var stats = areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e13,
  bestEffort: true
});

var areaSqM = ee.Number(stats.get('classification'));
var areaHectares = areaSqM.divide(10000);
var areaSqKm = areaSqM.divide(1000000);


// Calculate percentage of ROI
var roiArea = ee.Number(roi.geometry().area({maxError: 100}));
var percentageOfROI = areaSqM.divide(roiArea).multiply(100);


print('  Overall Accuracy:           ', overallAccuracy);
print('  Kappa Coefficient:          ', kappa);
print('  F1 Score (Saltmarsh):       ', f1_marsh);

print('  Producer\'s Accuracy:');
print('    - Non-Marsh:              ', PA_nonMarsh);
print('    - Saltmarsh:              ', PA_marsh);

print('  Consumer\'s Accuracy:');
print('    - Non-Marsh:              ', CA_nonMarsh);
print('    - Saltmarsh:              ', CA_marsh);

// print('  Confusion Matrix Values:');
// print('    - True Negatives (TN):    ', TN);
// print('    - False Positives (FP):   ', FP);
// print('    - False Negatives (FN):   ', FN);
// print('    - True Positives (TP):    ', TP);

//print('Area_Ha', areaHectares)

// Alternative: Export and calculate area in another tool
// Export.image.toDrive({
//   image: refinedClassification.clip(geometry),
//   description: 'Model_01_Objectbased_saltmarsh_area_',
//   scale: 10,
//   region: geometry,
//   maxPixels: 1e13
// });