import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';

export const financesRouter = Router();

// Get character finances
financesRouter.get('/:characterId', async (req: Request, res: Response) => {
  try {
    const finances = await db.queryOne(`
      SELECT * FROM character_finances WHERE character_id = ?
    `, [req.params.characterId]);

    if (!finances) {
      return res.status(404).json({ error: 'Finances not found' });
    }

    res.json(finances);
  } catch (error) {
    logger.error('Failed to fetch finances:', error);
    res.status(500).json({ error: 'Failed to fetch finances' });
  }
});

// Get transaction history
financesRouter.get('/:characterId/transactions', async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    let sql = `
      SELECT * FROM transactions 
      WHERE character_id = ?
    `;
    const params: unknown[] = [req.params.characterId];

    if (type) {
      sql += ` AND transaction_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const transactions = await db.query(sql, params);
    res.json(transactions);
  } catch (error) {
    logger.error('Failed to fetch transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Add money
financesRouter.post('/:characterId/add', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'cash', description, reference_id } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const validCurrencies = ['cash', 'bank', 'crypto', 'dirty_money'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency type' });
    }

    await db.transaction(async (conn) => {
      // Update balance
      await conn.query(`
        UPDATE character_finances SET ${currency} = ${currency} + ? WHERE character_id = ?
      `, [amount, req.params.characterId]);

      // Log transaction
      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description, reference_id)
        VALUES (?, 'reward', ?, ?, ?, ?)
      `, [req.params.characterId, amount, currency, description || null, reference_id || null]);
    });

    const finances = await db.queryOne(`SELECT * FROM character_finances WHERE character_id = ?`, [req.params.characterId]);
    res.json(finances);
  } catch (error) {
    logger.error('Failed to add money:', error);
    res.status(500).json({ error: 'Failed to add money' });
  }
});

// Remove money
financesRouter.post('/:characterId/remove', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'cash', description, reference_id } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const finances = await db.queryOne<Record<string, number>>(`
      SELECT * FROM character_finances WHERE character_id = ?
    `, [req.params.characterId]);

    if (!finances || finances[currency] < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await db.transaction(async (conn) => {
      await conn.query(`
        UPDATE character_finances SET ${currency} = ${currency} - ? WHERE character_id = ?
      `, [amount, req.params.characterId]);

      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description, reference_id)
        VALUES (?, 'purchase', ?, ?, ?, ?)
      `, [req.params.characterId, amount, currency, description || null, reference_id || null]);
    });

    const updatedFinances = await db.queryOne(`SELECT * FROM character_finances WHERE character_id = ?`, [req.params.characterId]);
    res.json(updatedFinances);
  } catch (error) {
    logger.error('Failed to remove money:', error);
    res.status(500).json({ error: 'Failed to remove money' });
  }
});

// Transfer money between characters
financesRouter.post('/:characterId/transfer', async (req: Request, res: Response) => {
  try {
    const { targetCharacterId, amount, currency = 'cash', description } = req.body;

    if (!targetCharacterId) {
      return res.status(400).json({ error: 'Target character ID required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const sourceFinances = await db.queryOne<Record<string, number>>(`
      SELECT * FROM character_finances WHERE character_id = ?
    `, [req.params.characterId]);

    if (!sourceFinances || sourceFinances[currency] < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await db.transaction(async (conn) => {
      // Deduct from source
      await conn.query(`
        UPDATE character_finances SET ${currency} = ${currency} - ? WHERE character_id = ?
      `, [amount, req.params.characterId]);

      // Add to target
      await conn.query(`
        UPDATE character_finances SET ${currency} = ${currency} + ? WHERE character_id = ?
      `, [amount, targetCharacterId]);

      // Log transactions
      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
        VALUES (?, 'transfer_out', ?, ?, ?)
      `, [req.params.characterId, amount, currency, description || `Transfer to character ${targetCharacterId}`]);

      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
        VALUES (?, 'transfer_in', ?, ?, ?)
      `, [targetCharacterId, amount, currency, description || `Transfer from character ${req.params.characterId}`]);
    });

    res.json({ success: true, transferred: amount, currency });
  } catch (error) {
    logger.error('Failed to transfer money:', error);
    res.status(500).json({ error: 'Failed to transfer money' });
  }
});

// Bank deposit
financesRouter.post('/:characterId/deposit', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const finances = await db.queryOne<{ cash: number }>(`
      SELECT cash FROM character_finances WHERE character_id = ?
    `, [req.params.characterId]);

    if (!finances || finances.cash < amount) {
      return res.status(400).json({ error: 'Insufficient cash' });
    }

    await db.transaction(async (conn) => {
      await conn.query(`
        UPDATE character_finances SET cash = cash - ?, bank = bank + ? WHERE character_id = ?
      `, [amount, amount, req.params.characterId]);

      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
        VALUES (?, 'deposit', ?, 'bank', 'Bank deposit')
      `, [req.params.characterId, amount]);
    });

    const updatedFinances = await db.queryOne(`SELECT * FROM character_finances WHERE character_id = ?`, [req.params.characterId]);
    res.json(updatedFinances);
  } catch (error) {
    logger.error('Failed to deposit:', error);
    res.status(500).json({ error: 'Failed to deposit' });
  }
});

// Bank withdraw
financesRouter.post('/:characterId/withdraw', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const finances = await db.queryOne<{ bank: number }>(`
      SELECT bank FROM character_finances WHERE character_id = ?
    `, [req.params.characterId]);

    if (!finances || finances.bank < amount) {
      return res.status(400).json({ error: 'Insufficient bank balance' });
    }

    await db.transaction(async (conn) => {
      await conn.query(`
        UPDATE character_finances SET cash = cash + ?, bank = bank - ? WHERE character_id = ?
      `, [amount, amount, req.params.characterId]);

      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
        VALUES (?, 'withdraw', ?, 'bank', 'Bank withdrawal')
      `, [req.params.characterId, amount]);
    });

    const updatedFinances = await db.queryOne(`SELECT * FROM character_finances WHERE character_id = ?`, [req.params.characterId]);
    res.json(updatedFinances);
  } catch (error) {
    logger.error('Failed to withdraw:', error);
    res.status(500).json({ error: 'Failed to withdraw' });
  }
});
