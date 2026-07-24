import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get(
  "/references",
  requireAuth,
  async (_req, res) => {

    try {

      const doctors = await pool.query(`
        SELECT
          id,
          name

        FROM doctors

        WHERE active = true

        ORDER BY name
      `);


      return res.json({
        doctors:doctors.rows,
      });


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_references_failed",
      });

    }

  },
);


router.get(
  "/summary",
  requireAuth,
  async (_req, res) => {

    try {

      const globalResult = await pool.query(`
        SELECT
          COALESCE(
            (
              SELECT SUM(w.total_amount)
              FROM works w
              WHERE w.status = 'active'
            ),
            0
          ) AS total_billed,

          COALESCE(
            (
              SELECT SUM(p.amount)
              FROM payments p
            ),
            0
          ) AS total_paid,

          (
            COALESCE(
              (
                SELECT SUM(w.total_amount)
                FROM works w
                WHERE w.status = 'active'
              ),
              0
            )
            -
            COALESCE(
              (
                SELECT SUM(p.amount)
                FROM payments p
              ),
              0
            )
          ) AS balance,

          (
            SELECT COUNT(*)
            FROM payments
          )::int AS payment_count
      `);


      const doctorsResult = await pool.query(`
        SELECT
          d.id AS doctor_id,
          d.name AS doctor_name,

          COALESCE(w.total_billed, 0)
            AS total_billed,

          COALESCE(p.total_paid, 0)
            AS total_paid,

          (
            COALESCE(w.total_billed, 0)
            -
            COALESCE(p.total_paid, 0)
          ) AS balance

        FROM doctors d

        LEFT JOIN (
          SELECT
            doctor_id,
            SUM(total_amount) AS total_billed

          FROM works

          WHERE status = 'active'

          GROUP BY doctor_id
        ) w
          ON w.doctor_id = d.id

        LEFT JOIN (
          SELECT
            doctor_id,
            SUM(amount) AS total_paid

          FROM payments

          GROUP BY doctor_id
        ) p
          ON p.doctor_id = d.id

        ORDER BY d.name
      `);


      return res.json({
        ...globalResult.rows[0],
        doctors:doctorsResult.rows,
      });


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_summary_failed",
      });

    }

  },
);


router.get(
  "/",
  requireAuth,
  async (_req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          p.id,
          p.doctor_id,
          p.amount,
          p.payment_date,
          p.note,
          p.created_at,

          d.name AS doctor_name

        FROM payments p

        JOIN doctors d
          ON d.id = p.doctor_id

        ORDER BY
          p.payment_date DESC,
          p.id DESC
      `);


      return res.json(result.rows);


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payments_load_failed",
      });

    }

  },
);


router.post(
  "/",
  requireAuth,
  async (req, res) => {

    const doctorId =
      Number(req.body?.doctor_id);

    const amount =
      Number(req.body?.amount);

    const note =
      String(req.body?.note ?? "")
        .trim();


    if(
      !Number.isInteger(doctorId) ||
      doctorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    try {

      const doctor = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE id = $1
        `,
        [doctorId],
      );


      if(doctor.rowCount === 0) {

        return res.status(400).json({
          error:"invalid_doctor",
        });

      }


      const result = await pool.query(
        `
        INSERT INTO payments(
          doctor_id,
          amount,
          note
        )

        VALUES($1,$2,$3)

        RETURNING *
        `,
        [
          doctorId,
          amount,
          note || null,
        ],
      );


      return res
        .status(201)
        .json(result.rows[0]);


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_creation_failed",
      });

    }

  },
);


export { router as paymentsRouter };
