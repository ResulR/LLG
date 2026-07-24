import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get("/", requireAuth, async (_req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        name,
        phone,
        active,
        created_at,
        updated_at
      FROM doctors
      ORDER BY created_at DESC
    `);


    return res.json(result.rows);


  } catch(error) {

    console.error(error);

    return res.status(500).json({
      error:"doctors_load_failed",
    });

  }

});


router.get(
  "/:id/details",
  requireAuth,
  async (req, res) => {

    const doctorId =
      Number(req.params.id);


    if(
      !Number.isInteger(doctorId) ||
      doctorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_doctor_id",
      });

    }


    try {

      const doctorResult = await pool.query(
        `
        SELECT
          id,
          name,
          phone,
          active,
          created_at,
          updated_at

        FROM doctors

        WHERE id = $1
        `,
        [doctorId],
      );


      if(doctorResult.rowCount === 0) {

        return res.status(404).json({
          error:"doctor_not_found",
        });

      }


      const summaryResult = await pool.query(
        `
        SELECT
          COALESCE(
            (
              SELECT SUM(total_amount)
              FROM works
              WHERE doctor_id = $1
                AND status = 'active'
            ),
            0
          ) AS total_billed,

          COALESCE(
            (
              SELECT SUM(amount)
              FROM payments
              WHERE doctor_id = $1
            ),
            0
          ) AS total_paid,

          GREATEST(
            COALESCE(
              (
                SELECT SUM(total_amount)
                FROM works
                WHERE doctor_id = $1
                  AND status = 'active'
              ),
              0
            )
            -
            COALESCE(
              (
                SELECT SUM(amount)
                FROM payments
                WHERE doctor_id = $1
              ),
              0
            ),
            0
          ) AS outstanding_balance,

          (
            SELECT COUNT(*)
            FROM works
            WHERE doctor_id = $1
              AND status = 'active'
          )::int AS active_work_count,

          (
            SELECT COUNT(*)
            FROM works
            WHERE doctor_id = $1
          )::int AS total_work_count,

          (
            SELECT COUNT(*)
            FROM payments
            WHERE doctor_id = $1
          )::int AS payment_count
        `,
        [doctorId],
      );


      const worksResult = await pool.query(
        `
        WITH payment_total AS (
          SELECT
            COALESCE(SUM(amount), 0) AS total_paid
          FROM payments
          WHERE doctor_id = $1
        ),

        ordered_active_works AS (
          SELECT
            w.id,

            COALESCE(
              SUM(w.total_amount) OVER (
                ORDER BY
                  w.work_date,
                  w.id

                ROWS BETWEEN
                  UNBOUNDED PRECEDING
                  AND 1 PRECEDING
              ),
              0
            ) AS previous_billed

          FROM works w

          WHERE w.doctor_id = $1
            AND w.status = 'active'
        ),

        allocations AS (
          SELECT
            oaw.id,

            GREATEST(
              LEAST(
                w.total_amount,
                pt.total_paid
                  - oaw.previous_billed
              ),
              0
            ) AS paid_amount

          FROM ordered_active_works oaw

          JOIN works w
            ON w.id = oaw.id

          CROSS JOIN payment_total pt
        )

        SELECT
          w.id,
          w.doctor_id,
          w.patient_id,
          w.material_id,
          w.color_id,
          w.year,
          w.month,
          w.monthly_number,
          w.work_date,
          w.price_per_tooth,
          w.total_amount,
          w.status,
          w.created_at,

          p.first_name,
          p.last_name,

          m.name AS material_name,
          c.name AS color_name,

          CASE
            WHEN w.status = 'cancelled'
              THEN 0
            ELSE COALESCE(a.paid_amount, 0)
          END AS paid_amount,

          CASE
            WHEN w.status = 'cancelled'
              THEN 0
            ELSE
              w.total_amount
              - COALESCE(a.paid_amount, 0)
          END AS remaining_amount,

          CASE
            WHEN w.status = 'cancelled'
              THEN 'cancelled'

            WHEN COALESCE(a.paid_amount, 0) >= w.total_amount
              THEN 'paid'

            WHEN COALESCE(a.paid_amount, 0) > 0
              THEN 'partial'

            ELSE 'unpaid'
          END AS payment_status,

          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'number',
                wt.tooth_number,

                'is_antar',
                wt.is_antar
              )
              ORDER BY wt.tooth_number
            )
            FILTER (
              WHERE wt.id IS NOT NULL
            ),
            '[]'::json
          ) AS teeth

        FROM works w

        JOIN patients p
          ON p.id = w.patient_id

        LEFT JOIN materials m
          ON m.id = w.material_id

        LEFT JOIN colors c
          ON c.id = w.color_id

        LEFT JOIN work_teeth wt
          ON wt.work_id = w.id

        LEFT JOIN allocations a
          ON a.id = w.id

        WHERE w.doctor_id = $1

        GROUP BY
          w.id,
          p.first_name,
          p.last_name,
          m.name,
          c.name,
          a.paid_amount

        ORDER BY
          w.work_date DESC,
          w.id DESC
        `,
        [doctorId],
      );


      const paymentsResult = await pool.query(
        `
        SELECT
          id,
          doctor_id,
          amount,
          payment_date,
          note,
          created_at

        FROM payments

        WHERE doctor_id = $1

        ORDER BY
          payment_date DESC,
          id DESC
        `,
        [doctorId],
      );


      return res.json({
        doctor:doctorResult.rows[0],
        summary:summaryResult.rows[0],
        works:worksResult.rows,
        payments:paymentsResult.rows,
      });


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"doctor_details_load_failed",
      });

    }

  },
);


router.get("/:id", requireAuth, async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        active,
        created_at,
        updated_at

      FROM doctors

      WHERE id = $1
      `,
      [req.params.id],
    );


    if(result.rowCount === 0) {

      return res.status(404).json({
        error:"doctor_not_found",
      });

    }


    return res.json(result.rows[0]);


  } catch(error) {

    console.error(error);

    return res.status(500).json({
      error:"doctor_load_failed",
    });

  }

});


router.post("/", requireAuth, async (req, res) => {

  const name =
    String(req.body?.name ?? "").trim();

  const phone =
    String(req.body?.phone ?? "").trim();


  if(!name) {

    return res.status(400).json({
      error:"missing_name",
    });

  }


  try {

    const result = await pool.query(
      `
      INSERT INTO doctors(
        name,
        phone
      )

      VALUES($1,$2)

      RETURNING *
      `,
      [
        name,
        phone || null,
      ],
    );


    return res
      .status(201)
      .json(result.rows[0]);


  } catch(error) {

    console.error(error);

    return res.status(500).json({
      error:"doctor_creation_failed",
    });

  }

});


router.put("/:id", requireAuth, async (req, res) => {

  const name =
    String(req.body?.name ?? "").trim();

  const phone =
    String(req.body?.phone ?? "").trim();


  if(!name) {

    return res.status(400).json({
      error:"missing_name",
    });

  }


  try {

    const result = await pool.query(
      `
      UPDATE doctors

      SET
        name = $1,
        phone = $2,
        updated_at = NOW()

      WHERE id = $3

      RETURNING *
      `,
      [
        name,
        phone || null,
        req.params.id,
      ],
    );


    if(result.rowCount === 0) {

      return res.status(404).json({
        error:"doctor_not_found",
      });

    }


    return res.json(result.rows[0]);


  } catch(error) {

    console.error(error);

    return res.status(500).json({
      error:"doctor_update_failed",
    });

  }

});


router.patch(
  "/:id/status",
  requireAuth,
  async (req, res) => {

    if(typeof req.body?.active !== "boolean") {

      return res.status(400).json({
        error:"invalid_status",
      });

    }


    try {

      const result = await pool.query(
        `
        UPDATE doctors

        SET
          active = $1,
          updated_at = NOW()

        WHERE id = $2

        RETURNING *
        `,
        [
          req.body.active,
          req.params.id,
        ],
      );


      if(result.rowCount === 0) {

        return res.status(404).json({
          error:"doctor_not_found",
        });

      }


      return res.json(result.rows[0]);


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"doctor_status_update_failed",
      });

    }

  },
);


export { router as doctorsRouter };
