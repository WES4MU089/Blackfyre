/**
 * Blackfyre Weapon Icon Generator
 *
 * PSD Structure Expected:
 *   - "rarity" group with layers: tier1, tier2, tier3, tier4, tier5
 *   - "weapons" group with weapon icon layers (each gets tier1-tier4)
 *   - "legendaryWeapons" group with legendary icon layers (each gets tier5)
 *
 * Output: <weaponLayerName>_<rarityLayerName>.png at full size + 64x64
 */

#target photoshop

// Suppress all dialogs for batch processing
app.displayDialogs = DialogModes.NO;

(function () {
    // --- Configuration ---
    var BASE_SIZE = 512;
    var REDUCED_SIZE = 64;
    var NORMAL_TIERS = ["tier1", "tier2", "tier3", "tier4"];
    var LEGENDARY_TIER = "tier5";

    // --- Validate document ---
    if (!app.documents.length) {
        alert("No document open. Please open your weapon icon PSD first.");
        return;
    }

    var doc = app.activeDocument;

    // --- Locate layer groups ---
    var rarityGroup, weaponsGroup, legendaryGroup;
    try { rarityGroup = doc.layerSets.getByName("rarity"); }
    catch (e) { alert("Missing layer group: \"rarity\""); return; }

    try { weaponsGroup = doc.layerSets.getByName("weapons"); }
    catch (e) { alert("Missing layer group: \"weapons\""); return; }

    try { legendaryGroup = doc.layerSets.getByName("legendaryWeapons"); }
    catch (e) { alert("Missing layer group: \"legendaryWeapons\""); return; }

    // --- Build rarity layer lookup ---
    var rarityLayers = {};
    for (var r = 0; r < rarityGroup.artLayers.length; r++) {
        rarityLayers[rarityGroup.artLayers[r].name] = rarityGroup.artLayers[r];
    }
    // Also check for sub-groups in rarity (in case tiers are groups)
    for (var r = 0; r < rarityGroup.layerSets.length; r++) {
        rarityLayers[rarityGroup.layerSets[r].name] = rarityGroup.layerSets[r];
    }

    // Validate that all needed tiers exist
    var allTiers = NORMAL_TIERS.concat([LEGENDARY_TIER]);
    for (var t = 0; t < allTiers.length; t++) {
        if (!rarityLayers[allTiers[t]]) {
            alert("Missing rarity layer: \"" + allTiers[t] + "\"");
            return;
        }
    }

    // --- Prompt for output folder ---
    var outputFolder = Folder.selectDialog("Select output folder for weapon icons");
    if (!outputFolder) {
        alert("No output folder selected. Aborting.");
        return;
    }

    // Create subdirectories for the two sizes
    var fullDir = new Folder(outputFolder.fsName + "/full");
    var smallDir = new Folder(outputFolder.fsName + "/64x64");
    if (!fullDir.exists) fullDir.create();
    if (!smallDir.exists) smallDir.create();

    // --- Gather weapon layers (artLayers + layerSets) ---
    var normalWeapons = collectChildren(weaponsGroup);
    var legendaryWeapons = collectChildren(legendaryGroup);

    var totalOps = (normalWeapons.length * NORMAL_TIERS.length) + legendaryWeapons.length;
    var completed = 0;

    // --- Hide everything first ---
    setGroupVisibility(rarityGroup, false);
    setGroupVisibility(weaponsGroup, false);
    setGroupVisibility(legendaryGroup, false);

    // --- Process normal weapons (tier1-tier4) ---
    for (var w = 0; w < normalWeapons.length; w++) {
        var weapon = normalWeapons[w];
        for (var t = 0; t < NORMAL_TIERS.length; t++) {
            var tierName = NORMAL_TIERS[t];
            exportCombo(weapon, rarityLayers[tierName], tierName, fullDir, smallDir);
            completed++;
        }
    }

    // --- Process legendary weapons (tier5 only) ---
    for (var w = 0; w < legendaryWeapons.length; w++) {
        var weapon = legendaryWeapons[w];
        exportCombo(weapon, rarityLayers[LEGENDARY_TIER], LEGENDARY_TIER, fullDir, smallDir);
        completed++;
    }

    // --- Restore visibility ---
    setGroupVisibility(rarityGroup, true);
    setGroupVisibility(weaponsGroup, true);
    setGroupVisibility(legendaryGroup, true);

    alert("Done! Generated " + (completed * 2) + " files (" + completed + " full + " + completed + " reduced).\n\nOutput: " + outputFolder.fsName);

    // =========================================================================
    // Helper Functions
    // =========================================================================

    /**
     * Collect all direct children of a group (both artLayers and layerSets).
     */
    function collectChildren(group) {
        var children = [];
        for (var i = 0; i < group.artLayers.length; i++) {
            children.push(group.artLayers[i]);
        }
        for (var i = 0; i < group.layerSets.length; i++) {
            children.push(group.layerSets[i]);
        }
        return children;
    }

    /**
     * Toggle visibility for a group and all its descendants.
     */
    function setGroupVisibility(group, visible) {
        group.visible = visible;
        for (var i = 0; i < group.artLayers.length; i++) {
            group.artLayers[i].visible = visible;
        }
        for (var i = 0; i < group.layerSets.length; i++) {
            group.layerSets[i].visible = visible;
            setGroupVisibility(group.layerSets[i], visible);
        }
    }

    /**
     * Hide all direct children of a group.
     */
    function hideAllChildren(group) {
        for (var i = 0; i < group.artLayers.length; i++) {
            group.artLayers[i].visible = false;
        }
        for (var i = 0; i < group.layerSets.length; i++) {
            group.layerSets[i].visible = false;
        }
    }

    /**
     * Export a single weapon+rarity combo at both sizes.
     */
    function exportCombo(weaponLayer, rarityLayer, tierName, fullDir, smallDir) {
        var baseName = weaponLayer.name + "_" + tierName;

        // Hide all rarity layers, then show only the target tier
        hideAllChildren(rarityGroup);
        rarityGroup.visible = true;
        rarityLayer.visible = true;

        // Hide all weapons in both groups, then show only the target weapon
        hideAllChildren(weaponsGroup);
        hideAllChildren(legendaryGroup);

        // Make the parent group visible so the weapon layer renders
        weaponsGroup.visible = true;
        legendaryGroup.visible = true;
        weaponLayer.visible = true;

        // --- Save full-size PNG ---
        var fullFile = new File(fullDir.fsName + "/" + baseName + ".png");
        savePNG(fullFile);

        // --- Save 64x64 reduced PNG (Preserve Details) ---
        var smallFile = new File(smallDir.fsName + "/" + baseName + ".png");
        saveReducedPNG(smallFile, REDUCED_SIZE);
    }

    /**
     * Save the current document state as a PNG (current dimensions).
     */
    function savePNG(file) {
        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;

        // Duplicate, flatten, save, close
        var dupe = doc.duplicate(file.name, true);
        dupe.flatten();
        dupe.saveAs(file, opts, true, Extension.LOWERCASE);
        dupe.close(SaveOptions.DONOTSAVECHANGES);
    }

    /**
     * Save a reduced-size PNG using Bicubic Sharper resampling (ideal for downscaling).
     */
    function saveReducedPNG(file, targetSize) {
        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;

        var dupe = doc.duplicate(file.name, true);
        dupe.flatten();

        dupe.resizeImage(
            UnitValue(targetSize, "px"),
            UnitValue(targetSize, "px"),
            dupe.resolution,
            ResampleMethod.BICUBICSHARPER
        );

        dupe.saveAs(file, opts, true, Extension.LOWERCASE);
        dupe.close(SaveOptions.DONOTSAVECHANGES);
    }

})();
