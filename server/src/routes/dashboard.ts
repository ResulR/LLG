import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get("/", requireAuth, async (_req, res) => {

  try {

    const overviewResult = await pool.query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM doctors
          WHERE active = true
        )::int AS active_doctors,

        (
          SELECT COUNT(*)
          FROM works
          WHERE status = 'active'
        )::int AS active_works,

        COALESCE(
          (
            SELECT SUM(total_amount)
            FROM works
            WHERE status = 'active'
          ),
          0
        ) AS total_billed,

        COALESCE(
          (
            SELECT SUM(amount)
            FROM payments
          ),
          0
        ) AS total_paid,

        GREATEST(
          COALESCE(
            (
              SELECT SUM(total_amount)
              FROM works
              WHERE status = 'active'
            ),
            0
          )
          -
          COALESCE(
            (
              SELECT SUM(amount)
              FROM payments
            ),
            0
          ),
          0
        ) AS outstanding_balance
    `);


    const receivablesResult = await pool.query(`
      WITH doctor_payments AS (
        SELECT
          doctor_id,
          SUM(amount) AS total_paid
        FROM payments
        GROUP BY doctor_id
      ),

      ordered_works AS (
        SELECT
          w.id,
          w.doctor_id,
          w.work_date,
          w.total_amount,

          COALESCE(
            SUM(w.total_amount) OVER (
              PARTITION BY w.doctor_id
              ORDER BY
                w.work_date,
                w.id
              ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
            ),
            0
          ) AS previous_billed

        FROM works w

        WHERE w.status = 'active'
      ),

      allocated_works AS (
        SELECT
          ow.id,
          ow.doctor_id,
          ow.work_date,
          ow.total_amount,

          GREATEST(
            LEAST(
              ow.total_amount,
              COALESCE(dp.total_paid, 0)
                - ow.previous_billed
            ),
            0
          ) AS paid_allocated

        FROM ordered_works ow

        LEFT JOIN doctor_payments dp
          ON dp.doctor_id = ow.doctor_id
      ),

      remaining_works AS (
        SELECT
          id,
          doctor_id,
          work_date,
          total_amount,
          paid_allocated,
          total_amount - paid_allocated
            AS remaining_amount

        FROM allocated_works
      )

      SELECT
        d.id AS doctor_id,
        d.name AS doctor_name,

        COALESCE(
          SUM(rw.total_amount),
          0
        ) AS total_billed,

        LEAST(
          COALESCE(dp.total_paid, 0),
          COALESCE(SUM(rw.total_amount), 0)
        ) AS total_paid,

        COALESCE(
          SUM(rw.remaining_amount),
          0
        ) AS outstanding_balance,

        MIN(rw.work_date)
          FILTER (
            WHERE rw.remaining_amount > 0
          ) AS oldest_unpaid_date,

        COALESCE(
          CURRENT_DATE
          -
          MIN(rw.work_date)
            FILTER (
              WHERE rw.remaining_amount > 0
            ),
          0
        )::int AS days_outstanding,

        COUNT(rw.id)
          FILTER (
            WHERE rw.remaining_amount > 0
          )::int AS unpaid_work_count

      FROM doctors d

      JOIN remaining_works rw
        ON rw.doctor_id = d.id

      LEFT JOIN doctor_payments dp
        ON dp.doctor_id = d.id

      GROUP BY
        d.id,
        d.name,
        dp.total_paid

      HAVING
        COALESCE(
          SUM(rw.remaining_amount),
          0
        ) > 0

      ORDER BY
        days_outstanding DESC,
        outstanding_balance DESC,
        d.name
    `);


    const recentWorksResult = await pool.query(`
      SELECT
        w.id,
        w.year,
        w.month,
        w.monthly_number,
        w.work_date,
        w.total_amount,
        w.status,

        d.name AS doctor_name,

        p.first_name,
        p.last_name

      FROM works w

      JOIN doctors d
        ON d.id = w.doctor_id

      JOIN patients p
        ON p.id = w.patient_id

      ORDER BY
        w.created_at DESC,
        w.id DESC

      LIMIT 5
    `);


    const recentPaymentsResult = await pool.query(`
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.note,

        d.name AS doctor_name

      FROM payments p

      JOIN doctors d
        ON d.id = p.doctor_id

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT 5
    `);


    return res.json({
      overview:overviewResult.rows[0],
      receivables:receivablesResult.rows,
      recent_works:recentWorksResult.rows,
      recent_payments:recentPaymentsResult.rows,
    });


  } catch(error) {

    console.error(error);

    return res.status(500).json({
      error:"dashboard_load_failed",
    });

  }

});


export { router as dashboardRouter };
