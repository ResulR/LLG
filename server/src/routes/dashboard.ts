import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get("/", requireAuth, async (req, res) => {

  try {

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

    const overviewResult = await pool.query(`
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
          ) AS open_work_balance

        FROM works w

        LEFT JOIN individual_payments ip
          ON ip.work_id = w.id

        GROUP BY w.doctor_id
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

      settlement_totals AS (
        SELECT
          doctor_id,

          COALESCE(
            SUM(works_total),
            0
          ) AS settled_total

        FROM doctor_settlements

        GROUP BY doctor_id
      ),

      doctor_finances AS (
        SELECT
          d.id AS doctor_id,

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
            (
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.doctor_id = d.id
            ),
            0
          ) AS total_paid,

          COALESCE(
            wf.open_work_balance,
            0
          )
          +
          GREATEST(
            COALESCE(
              st.settled_total,
              0
            )
              - COALESCE(
                  go.covered_total,
                  0
                ),
            0
          ) AS outstanding_balance

        FROM doctors d

        LEFT JOIN work_finances wf
          ON wf.doctor_id = d.id

        LEFT JOIN settlement_totals st
          ON st.doctor_id = d.id

        LEFT JOIN global_operations go
          ON go.doctor_id = d.id
      )

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
          SUM(total_billed),
          0
        ) AS total_billed,

        COALESCE(
          SUM(total_paid),
          0
        ) AS total_paid,

        COALESCE(
          SUM(outstanding_balance),
          0
        ) AS outstanding_balance

      FROM doctor_finances
    `);


    const receivablesResult = await pool.query(`
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

          MIN(w.work_date)
            FILTER (
              WHERE w.status = 'active'
                AND w.payment_status IN (
                  'unpaid',
                  'partial'
                )
                AND GREATEST(
                  w.total_amount
                    - COALESCE(
                        ip.paid_amount,
                        0
                      ),
                  0
                ) > 0
            ) AS oldest_open_work_date,

          COUNT(w.id)
            FILTER (
              WHERE w.status = 'active'
                AND w.payment_status IN (
                  'unpaid',
                  'partial'
                )
                AND GREATEST(
                  w.total_amount
                    - COALESCE(
                        ip.paid_amount,
                        0
                      ),
                  0
                ) > 0
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
          ) AS settled_total,

          MIN(settlement_date)
            AS oldest_settlement_date

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

      doctor_finances AS (
        SELECT
          d.id AS doctor_id,
          d.name AS doctor_name,

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
            (
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.doctor_id = d.id
            ),
            0
          ) AS total_paid,

          COALESCE(
            wf.open_work_balance,
            0
          ) AS open_work_balance,

          GREATEST(
            COALESCE(
              st.settled_total,
              0
            )
              - COALESCE(
                  go.covered_total,
                  0
                ),
            0
          ) AS global_balance,

          wf.oldest_open_work_date,
          st.oldest_settlement_date,

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
      )

      SELECT
        doctor_id,
        doctor_name,
        total_billed,
        total_paid,

        open_work_balance
          + global_balance
          AS outstanding_balance,

        CASE
          WHEN open_work_balance > 0
            AND global_balance > 0
          THEN LEAST(
            oldest_open_work_date,
            oldest_settlement_date
          )

          WHEN open_work_balance > 0
          THEN oldest_open_work_date

          WHEN global_balance > 0
          THEN oldest_settlement_date

          ELSE NULL
        END AS oldest_unpaid_date,

        COALESCE(
          CURRENT_DATE
          -
          CASE
            WHEN open_work_balance > 0
              AND global_balance > 0
            THEN LEAST(
              oldest_open_work_date,
              oldest_settlement_date
            )

            WHEN open_work_balance > 0
            THEN oldest_open_work_date

            WHEN global_balance > 0
            THEN oldest_settlement_date

            ELSE CURRENT_DATE
          END,
          0
        )::int AS days_outstanding,

        unpaid_work_count

      FROM doctor_finances

      WHERE
        open_work_balance
          + global_balance > 0

      ORDER BY
        days_outstanding DESC,
        outstanding_balance DESC,
        doctor_name
    `);


    const monthlyActivityResult =
      await pool.query(
        `
        SELECT
          COALESCE(
            (
              SELECT SUM(total_amount)
              FROM works
              WHERE status = 'active'
                AND (
                  $1::text IS NULL
                  OR (
                    work_date >=
                      TO_DATE(
                        $1 || '-01',
                        'YYYY-MM-DD'
                      )
                    AND work_date <
                      TO_DATE(
                        $1 || '-01',
                        'YYYY-MM-DD'
                      )
                      + INTERVAL '1 month'
                  )
                )
            ),
            0
          ) AS total_billed,

          COALESCE(
            (
              SELECT SUM(amount)
              FROM payments
              WHERE (
                $1::text IS NULL
                OR (
                  payment_date >=
                    TO_DATE(
                      $1 || '-01',
                      'YYYY-MM-DD'
                    )
                  AND payment_date <
                    TO_DATE(
                      $1 || '-01',
                      'YYYY-MM-DD'
                    )
                    + INTERVAL '1 month'
                )
              )
            ),
            0
          ) AS total_paid
        `,
        [monthParameter],
      );


    const recentWorksResult = await pool.query(
      `
      SELECT
        w.id,
        w.year,
        w.month,
        w.monthly_number,
        w.work_date,
        w.description,
        w.is_repeat,
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

      WHERE (
        $1::text IS NULL
        OR (
          w.work_date >=
            TO_DATE(
              $1 || '-01',
              'YYYY-MM-DD'
            )
          AND w.work_date <
            TO_DATE(
              $1 || '-01',
              'YYYY-MM-DD'
            )
            + INTERVAL '1 month'
        )
      )

      ORDER BY
        w.created_at DESC,
        w.id DESC

      LIMIT 5
      `,
      [monthParameter],
    );


    const recentPaymentsResult = await pool.query(
      `
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.note,

        d.name AS doctor_name

      FROM payments p

      JOIN doctors d
        ON d.id = p.doctor_id

      WHERE (
        $1::text IS NULL
        OR (
          p.payment_date >=
            TO_DATE(
              $1 || '-01',
              'YYYY-MM-DD'
            )
          AND p.payment_date <
            TO_DATE(
              $1 || '-01',
              'YYYY-MM-DD'
            )
            + INTERVAL '1 month'
        )
      )

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT 5
      `,
      [monthParameter],
    );


    return res.json({
      overview:{
        ...overviewResult.rows[0],

        total_billed:
          monthlyActivityResult
            .rows[0]
            .total_billed,

        total_paid:
          monthlyActivityResult
            .rows[0]
            .total_paid,
      },
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
