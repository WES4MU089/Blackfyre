/**
 * Alchemy / crafting API routes.
 *
 * POST /brew       — Combine ingredients into a medicine
 * POST /identify   — Identify a patient's ailment by symptoms (Lore check)
 * GET  /recipes    — List all known recipes
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { rollCombatPool } from '../../combat/dice.js';
import { findFirstEmptySlot } from './inventory.js';

export const craftingRouter = Router();

/**
 * GET /recipes — List all alchemy recipes.
 */
craftingRouter.get('/recipes', async (_req: Request, res: Response) => {
  try {
    const recipes = await db.query(`
      SELECT ar.id, ar.recipe_key, ar.name, ar.description,
             ar.target_ailment_key, ar.result_item_key, ar.lore_requirement
      FROM alchemy_recipes ar
      ORDER BY ar.name
    `);

    // Load ingredients for each recipe
    const result = [];
    for (const recipe of recipes as Array<Record<string, unknown>>) {
      const ingredients = await db.query(`
        SELECT ri.item_key, ri.quantity, i.name AS item_name
        FROM recipe_ingredients ri
        JOIN items i ON ri.item_key = i.item_key
        WHERE ri.recipe_id = ?
      `, [recipe.id]);

      result.push({
        recipeKey: recipe.recipe_key,
        name: recipe.name,
        description: recipe.description,
        targetAilment: recipe.target_ailment_key,
        resultItemKey: recipe.result_item_key,
        loreRequirement: recipe.lore_requirement,
        ingredients: (ingredients as Array<Record<string, unknown>>).map(i => ({
          itemKey: i.item_key,
          itemName: i.item_name,
          quantity: i.quantity,
        })),
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

/**
 * POST /brew — Combine ingredients to create a medicine.
 *
 * Body: { crafterId: number, recipeKey: string }
 */
craftingRouter.post('/brew', async (req: Request, res: Response) => {
  try {
    const { crafterId, recipeKey } = req.body;

    if (!crafterId || !recipeKey) {
      return res.status(400).json({ error: 'crafterId and recipeKey are required' });
    }

    // Load recipe
    const recipe = await db.queryOne<{
      id: number;
      result_item_key: string;
      lore_requirement: number;
      name: string;
    }>(`
      SELECT id, result_item_key, lore_requirement, name
      FROM alchemy_recipes WHERE recipe_key = ?
    `, [recipeKey]);

    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Check crafter's Lore meets requirement
    const aptRow = await db.queryOne<{ current_value: number }>(`
      SELECT current_value FROM character_aptitudes
      WHERE character_id = ? AND aptitude_key = 'lore'
    `, [crafterId]);
    const lore = aptRow?.current_value ?? 1;

    if (lore < recipe.lore_requirement) {
      return res.status(400).json({
        error: `Requires Lore ${recipe.lore_requirement}, you have Lore ${lore}`,
      });
    }

    // Load required ingredients
    const requiredIngredients = await db.query<{
      item_key: string;
      quantity: number;
    }>(`
      SELECT item_key, quantity FROM recipe_ingredients WHERE recipe_id = ?
    `, [recipe.id]);

    // Check crafter has all ingredients
    for (const req_ingredient of requiredIngredients) {
      const owned = await db.queryOne<{ total: number }>(`
        SELECT COALESCE(SUM(ci.quantity), 0) AS total
        FROM character_inventory ci
        JOIN items i ON ci.item_id = i.id
        WHERE ci.character_id = ? AND i.item_key = ?
      `, [crafterId, req_ingredient.item_key]);

      if (!owned || owned.total < req_ingredient.quantity) {
        const itemName = await db.queryOne<{ name: string }>(`
          SELECT name FROM items WHERE item_key = ?
        `, [req_ingredient.item_key]);
        return res.status(400).json({
          error: `Missing ingredient: ${itemName?.name ?? req_ingredient.item_key} (need ${req_ingredient.quantity}, have ${owned?.total ?? 0})`,
        });
      }
    }

    // Check crafter has inventory space
    const emptySlot = await findFirstEmptySlot(crafterId);
    if (emptySlot === null) {
      return res.status(400).json({ error: 'Inventory full — no empty slot for the result' });
    }

    // Consume ingredients and create result in a transaction
    await db.transaction(async (conn) => {
      for (const req_ingredient of requiredIngredients) {
        let remaining = req_ingredient.quantity;

        const stacks = await conn.query<{ id: number; quantity: number }>(`
          SELECT ci.id, ci.quantity
          FROM character_inventory ci
          JOIN items i ON ci.item_id = i.id
          WHERE ci.character_id = ? AND i.item_key = ?
          ORDER BY ci.quantity ASC
        `, [crafterId, req_ingredient.item_key]);

        for (const stack of stacks) {
          if (remaining <= 0) break;

          if (stack.quantity <= remaining) {
            await conn.query(`DELETE FROM character_inventory WHERE id = ?`, [stack.id]);
            remaining -= stack.quantity;
          } else {
            await conn.query(
              `UPDATE character_inventory SET quantity = quantity - ? WHERE id = ?`,
              [remaining, stack.id],
            );
            remaining = 0;
          }
        }
      }

      // Create result item
      const resultItem = await conn.query<{ id: number }[]>(
        `SELECT id FROM items WHERE item_key = ?`,
        [recipe.result_item_key],
      );

      if (resultItem[0]) {
        await conn.query(`
          INSERT INTO character_inventory (character_id, item_id, quantity, slot_number)
          VALUES (?, ?, 1, ?)
        `, [crafterId, resultItem[0].id, emptySlot]);
      }
    });

    res.json({
      success: true,
      message: `Brewed ${recipe.name}`,
      resultItemKey: recipe.result_item_key,
      slot: emptySlot,
    });
  } catch (error) {
    logger.error('Failed to brew:', error);
    res.status(500).json({ error: 'Failed to brew' });
  }
});

/**
 * POST /identify — Identify a patient's ailment by symptoms.
 *
 * Body: { crafterId: number, targetCharacterId: number }
 */
craftingRouter.post('/identify', async (req: Request, res: Response) => {
  try {
    const { crafterId, targetCharacterId } = req.body;

    if (!crafterId || !targetCharacterId) {
      return res.status(400).json({ error: 'crafterId and targetCharacterId are required' });
    }

    // Load active ailments for patient
    const ailments = await db.query<{
      ailment_key: string;
      ailment_name: string;
      current_stage: number;
      stage_name: string;
      symptoms: string;
    }>(`
      SELECT ad.ailment_key, ad.name AS ailment_name,
             ca.current_stage, ast.name AS stage_name, ast.symptoms
      FROM character_ailments ca
      JOIN ailment_definitions ad ON ca.ailment_id = ad.id
      JOIN ailment_stages ast ON ast.ailment_id = ad.id AND ast.stage_number = ca.current_stage
      WHERE ca.character_id = ?
    `, [targetCharacterId]);

    if (ailments.length === 0) {
      return res.json({ ailments: [], message: 'No ailments detected' });
    }

    // Roll Lore check for identification
    const aptRow = await db.queryOne<{ current_value: number }>(`
      SELECT current_value FROM character_aptitudes
      WHERE character_id = ? AND aptitude_key = 'lore'
    `, [crafterId]);
    const lore = aptRow?.current_value ?? 1;
    const lorePool = rollCombatPool(lore);
    const succeeded = lorePool.successes >= 1;

    const results = ailments.map(a => {
      const allSymptoms: string[] = typeof a.symptoms === 'string'
        ? JSON.parse(a.symptoms)
        : a.symptoms ?? [];

      if (succeeded) {
        return {
          ailmentKey: a.ailment_key,
          name: a.ailment_name,
          stage: a.current_stage,
          stageName: a.stage_name,
          symptoms: allSymptoms,
          identified: true,
        };
      } else {
        // On failure: reveal only partial symptoms, no name
        const partialCount = Math.max(1, Math.floor(allSymptoms.length / 2));
        const shuffled = [...allSymptoms].sort(() => Math.random() - 0.5);
        return {
          ailmentKey: null,
          name: 'Unknown ailment',
          stage: null,
          stageName: null,
          symptoms: shuffled.slice(0, partialCount),
          identified: false,
        };
      }
    });

    // If identified, suggest matching recipes
    let suggestedRecipes: Array<{ recipeKey: string; name: string }> = [];
    if (succeeded) {
      const ailmentKeys = ailments.map(a => a.ailment_key);
      if (ailmentKeys.length > 0) {
        suggestedRecipes = await db.query(`
          SELECT recipe_key, name FROM alchemy_recipes
          WHERE target_ailment_key IN (${ailmentKeys.map(() => '?').join(',')})
        `, ailmentKeys);
      }
    }

    res.json({
      loreRoll: {
        pool: lorePool.effectivePool,
        dice: lorePool.dice,
        successes: lorePool.successes,
      },
      identified: succeeded,
      ailments: results,
      suggestedRecipes,
    });
  } catch (error) {
    logger.error('Failed to identify ailment:', error);
    res.status(500).json({ error: 'Failed to identify ailment' });
  }
});
