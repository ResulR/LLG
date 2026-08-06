import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get("/", requireAuth, async (_req, res) => {

  try {

    const result = await pool.query(`
      WITH individual_payments AS (
        SELECT
          work_id,

          COALESCE(
            SUM(amount),
            0
          ) AS paid_amount

        FROM payments

        WHERE payment_type = 'individual'
          AND work_id IS NOT NULL

        GROUP BY work_id
      ),

      work_finances AS (
        SELECT
          w.doctor_id,

          COALESCE(
            SUM(w.total_amount)
              FILTER (
                WHERE w.status = 'active'
              ),
            0
          ) AS active_work_total,

          COALESCE(
            SUM(
              CASE
                WHEN w.status = 'active'
                  AND w.payment_status IN (
                    'unpaid',
                    'partial'
                  )
                THEN GREATEST(
                  w.total_amount
                    - COALESCE(
                        ip.paid_amount,
                        0
                      ),
                  0
                )

                ELSE 0
              END
            ),
            0
          ) AS open_work_balance,

          COUNT(*)
            FILTER (
              WHERE w.status = 'active'
            )::int AS active_work_count,

          COUNT(*)::int AS total_work_count,

          COUNT(*)
            FILTER (
              WHERE w.status = 'active'
                AND w.payment_status IN (
                  'unpaid',
                  'partial'
                )
            )::int AS unpaid_work_count

        FROM works w

        LEFT JOIN individual_payments ip
          ON ip.work_id = w.id

        GROUP BY w.doctor_id
      ),

      settlement_totals AS (
        SELECT
          doctor_id,

          COALESCE(
            SUM(works_total),
            0
          ) AS total

        FROM doctor_settlements

        GROUP BY doctor_id
      ),

      global_operations AS (
        SELECT
          doctor_id,

          COALESCE(
            SUM(adjustment_amount),
            0
          ) AS adjustment_total,

          COALESCE(
            SUM(
              amount + adjustment_amount
            ),
            0
          ) AS covered_total

        FROM payments

        WHERE payment_type = 'global'

        GROUP BY doctor_id
      ),

      payment_totals AS (
        SELECT
          doctor_id,

          COALESCE(
            SUM(amount),
            0
          ) AS total_paid

        FROM payments

        GROUP BY doctor_id
      )

      SELECT
        d.id,
        d.name,
        d.phone,
        d.active,
        d.created_at,
        d.updated_at,

        GREATEST(
          COALESCE(
            wf.active_work_total,
            0
          )
            - COALESCE(
                go.adjustment_total,
                0
              ),
          0
        ) AS total_billed,

        COALESCE(
          pt.total_paid,
          0
        ) AS total_paid,

        COALESCE(
          wf.open_work_balance,
          0
        )
        +
        GREATEST(
          COALESCE(
            st.total,
            0
          )
            - COALESCE(
                go.covered_total,
                0
              ),
          0
        ) AS outstanding_balance,

        COALESCE(
          wf.active_work_count,
          0
        )::int AS active_work_count,

        COALESCE(
          wf.total_work_count,
          0
        )::int AS total_work_count,

        COALESCE(
          wf.unpaid_work_count,
          0
        )::int AS unpaid_work_count

      FROM doctors d

      LEFT JOIN work_finances wf
        ON wf.doctor_id = d.id

      LEFT JOIN settlement_totals st
        ON st.doctor_id = d.id

      LEFT JOIN global_operations go
        ON go.doctor_id = d.id

      LEFT JOIN payment_totals pt
        ON pt.doctor_id = d.id

      ORDER BY
        d.active DESC,
        d.created_at DESC
    `);


    return res.json(
      result.rows,
    );


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

    const selectedMonth =
      String(
        req.query.month ?? "",
      ).trim();

    const validMonth =
      /^\d{4}-\d{2}$/.test(
        selectedMonth,
      );

    const monthParameter =
      validMonth
        ? selectedMonth
        : null;


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
        WITH individual_payments AS (
          SELECT
            work_id,
            COALESCE(SUM(amount), 0)
              AS paid_amount

          FROM payments

          WHERE payment_type = 'individual'
            AND work_id IS NOT NULL

          GROUP BY work_id
        ),

        work_finances AS (
          SELECT
            COALESCE(
              SUM(w.total_amount)
                FILTER (
                  WHERE w.status = 'active'
                ),
              0
            ) AS active_work_total,

            COALESCE(
              SUM(
                CASE
                  WHEN w.status = 'active'
                    AND w.payment_status IN (
                      'unpaid',
                      'partial'
                    )
                  THEN GREATEST(
                    w.total_amount
                      - COALESCE(
                          ip.paid_amount,
                          0
                        ),
                    0
                  )

                  ELSE 0
                END
              ),
              0
            ) AS open_work_balance

          FROM works w

          LEFT JOIN individual_payments ip
            ON ip.work_id = w.id

          WHERE w.doctor_id = $1
        ),

        settlement_total AS (
          SELECT
            COALESCE(
              SUM(works_total),
              0
            ) AS total

          FROM doctor_settlements

          WHERE doctor_id = $1
        ),

        global_operations AS (
          SELECT
            COALESCE(
              SUM(adjustment_amount),
              0
            ) AS adjustment_total,

            COALESCE(
              SUM(
                amount + adjustment_amount
              ),
              0
            ) AS covered_total

          FROM payments

          WHERE doctor_id = $1
            AND payment_type = 'global'
        )

        SELECT
          GREATEST(
            wf.active_work_total
              - go.adjustment_total,
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

          wf.open_work_balance
          +
          GREATEST(
            st.total
              - go.covered_total,
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

        FROM work_finances wf
        CROSS JOIN settlement_total st
        CROSS JOIN global_operations go
        `,
        [doctorId],
      );


      const worksResult = await pool.query(
        `
        WITH individual_payments AS (
          SELECT
            work_id,
            COALESCE(SUM(amount), 0)
              AS paid_amount

          FROM payments

          WHERE payment_type = 'individual'
            AND work_id IS NOT NULL

          GROUP BY work_id
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
          w.description,
          w.is_repeat,
          w.pricing_mode,
          w.price_per_tooth,
          w.original_total_amount,
          w.total_amount,
          w.status,
          w.payment_status,
          w.created_at,

          p.first_name,
          p.last_name,

          m.name AS material_name,
          c.name AS color_name,

          CASE
            WHEN w.status = 'cancelled'
              THEN 0

            WHEN w.payment_status =
              'closed_global'
              THEN w.total_amount

            ELSE LEAST(
              COALESCE(
                ip.paid_amount,
                0
              ),
              w.total_amount
            )
          END AS paid_amount,

          CASE
            WHEN w.status = 'cancelled'
              THEN 0

            WHEN w.payment_status =
              'closed_global'
              THEN 0

            ELSE GREATEST(
              w.total_amount
                - COALESCE(
                    ip.paid_amount,
                    0
                  ),
              0
            )
          END AS remaining_amount,

          CASE
            WHEN w.status = 'cancelled'
              THEN 'cancelled'

            ELSE w.payment_status
          END AS displayed_payment_status,

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

        LEFT JOIN individual_payments ip
          ON ip.work_id = w.id

        WHERE w.doctor_id = $1
          AND (
            $2::text IS NULL
            OR (
              w.work_date >=
                TO_DATE(
                  $2 || '-01',
                  'YYYY-MM-DD'
                )
              AND w.work_date <
                TO_DATE(
                  $2 || '-01',
                  'YYYY-MM-DD'
                )
                + INTERVAL '1 month'
            )
          )

        GROUP BY
          w.id,
          p.first_name,
          p.last_name,
          m.name,
          c.name,
          ip.paid_amount

        ORDER BY
          w.work_date DESC,
          w.id DESC
        `,
        [
          doctorId,
          monthParameter,
        ],
      );


      const normalizedWorks =
        worksResult.rows.map(
          (work)=>({
            ...work,

            payment_status:
              work.displayed_payment_status,
          }),
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
          AND (
            $2::text IS NULL
            OR (
              payment_date >=
                TO_DATE(
                  $2 || '-01',
                  'YYYY-MM-DD'
                )
              AND payment_date <
                TO_DATE(
                  $2 || '-01',
                  'YYYY-MM-DD'
                )
                + INTERVAL '1 month'
            )
          )

        ORDER BY
          payment_date DESC,
          id DESC
        `,
        [
          doctorId,
          monthParameter,
        ],
      );


      return res.json({
        doctor:doctorResult.rows[0],
        summary:summaryResult.rows[0],
        works:normalizedWorks,
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
