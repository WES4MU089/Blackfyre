import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';

export const jobsRouter = Router();

// Get all available jobs
jobsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const jobs = await db.query(`
      SELECT j.*, 
             (SELECT COUNT(*) FROM character_jobs cj WHERE cj.job_id = j.id) as employee_count
      FROM jobs j
      WHERE j.is_active = TRUE
      ORDER BY j.category, j.name
    `);
    res.json(jobs);
  } catch (error) {
    logger.error('Failed to fetch jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get job details with grades
jobsRouter.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await db.queryOne(`SELECT * FROM jobs WHERE id = ?`, [req.params.jobId]);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const grades = await db.query(`
      SELECT * FROM job_grades WHERE job_id = ? ORDER BY grade
    `, [req.params.jobId]);

    res.json({ ...job, grades });
  } catch (error) {
    logger.error('Failed to fetch job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get character's jobs
jobsRouter.get('/character/:characterId', async (req: Request, res: Response) => {
  try {
    const jobs = await db.query(`
      SELECT cj.*, j.job_key, j.name as job_name, j.category, j.icon_url,
             jg.name as grade_name, jg.salary, jg.permissions
      FROM character_jobs cj
      JOIN jobs j ON cj.job_id = j.id
      LEFT JOIN job_grades jg ON j.id = jg.job_id AND cj.grade = jg.grade
      WHERE cj.character_id = ?
      ORDER BY cj.is_primary DESC, j.name
    `, [req.params.characterId]);

    res.json(jobs);
  } catch (error) {
    logger.error('Failed to fetch character jobs:', error);
    res.status(500).json({ error: 'Failed to fetch character jobs' });
  }
});

// Hire character for a job
jobsRouter.post('/character/:characterId/hire', async (req: Request, res: Response) => {
  try {
    const { job_key, grade = 0, is_primary = false } = req.body;

    const job = await db.queryOne<{ id: number; name: string }>(`
      SELECT id, name FROM jobs WHERE job_key = ? AND is_active = TRUE
    `, [job_key]);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if already has this job
    const existingJob = await db.queryOne(`
      SELECT id FROM character_jobs WHERE character_id = ? AND job_id = ?
    `, [req.params.characterId, job.id]);

    if (existingJob) {
      return res.status(400).json({ error: 'Character already has this job' });
    }

    await db.transaction(async (conn) => {
      // If setting as primary, remove primary from other jobs
      if (is_primary) {
        await conn.query(`
          UPDATE character_jobs SET is_primary = FALSE WHERE character_id = ?
        `, [req.params.characterId]);
      }

      // Add job
      await conn.query(`
        INSERT INTO character_jobs (character_id, job_id, grade, is_primary)
        VALUES (?, ?, ?, ?)
      `, [req.params.characterId, job.id, grade, is_primary]);
    });

    res.json({ success: true, message: `Hired for ${job.name}` });
  } catch (error) {
    logger.error('Failed to hire for job:', error);
    res.status(500).json({ error: 'Failed to hire for job' });
  }
});

// Fire character from a job
jobsRouter.post('/character/:characterId/fire', async (req: Request, res: Response) => {
  try {
    const { job_key } = req.body;

    const job = await db.queryOne<{ id: number; name: string }>(`
      SELECT id, name FROM jobs WHERE job_key = ?
    `, [job_key]);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const affected = await db.execute(`
      DELETE FROM character_jobs WHERE character_id = ? AND job_id = ?
    `, [req.params.characterId, job.id]);

    if (affected === 0) {
      return res.status(404).json({ error: 'Character does not have this job' });
    }

    res.json({ success: true, message: `Fired from ${job.name}` });
  } catch (error) {
    logger.error('Failed to fire from job:', error);
    res.status(500).json({ error: 'Failed to fire from job' });
  }
});

// Promote/demote character
jobsRouter.post('/character/:characterId/grade', async (req: Request, res: Response) => {
  try {
    const { job_key, new_grade } = req.body;

    const job = await db.queryOne<{ id: number; max_grade: number }>(`
      SELECT id, max_grade FROM jobs WHERE job_key = ?
    `, [job_key]);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (new_grade < 0 || new_grade > job.max_grade) {
      return res.status(400).json({ error: `Grade must be between 0 and ${job.max_grade}` });
    }

    const affected = await db.execute(`
      UPDATE character_jobs SET grade = ? WHERE character_id = ? AND job_id = ?
    `, [new_grade, req.params.characterId, job.id]);

    if (affected === 0) {
      return res.status(404).json({ error: 'Character does not have this job' });
    }

    const gradeInfo = await db.queryOne(`
      SELECT * FROM job_grades WHERE job_id = ? AND grade = ?
    `, [job.id, new_grade]);

    res.json({ success: true, newGrade: gradeInfo });
  } catch (error) {
    logger.error('Failed to update grade:', error);
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

// Process paycheck for a character
jobsRouter.post('/character/:characterId/paycheck', async (req: Request, res: Response) => {
  try {
    // Get primary job salary
    const job = await db.queryOne<{ salary: number; job_name: string }>(`
      SELECT jg.salary, j.name as job_name
      FROM character_jobs cj
      JOIN jobs j ON cj.job_id = j.id
      JOIN job_grades jg ON j.id = jg.job_id AND cj.grade = jg.grade
      WHERE cj.character_id = ? AND cj.is_primary = TRUE
    `, [req.params.characterId]);

    if (!job || job.salary === 0) {
      return res.status(400).json({ error: 'No paycheck available' });
    }

    await db.transaction(async (conn) => {
      // Add salary to bank
      await conn.query(`
        UPDATE character_finances SET bank = bank + ? WHERE character_id = ?
      `, [job.salary, req.params.characterId]);

      // Log transaction
      await conn.query(`
        INSERT INTO transactions (character_id, transaction_type, amount, currency_type, description)
        VALUES (?, 'paycheck', ?, 'bank', ?)
      `, [req.params.characterId, job.salary, `Paycheck from ${job.job_name}`]);
    });

    res.json({ success: true, amount: job.salary, job: job.job_name });
  } catch (error) {
    logger.error('Failed to process paycheck:', error);
    res.status(500).json({ error: 'Failed to process paycheck' });
  }
});
