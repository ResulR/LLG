import {
  Router,
} from "express";

import {
  pool,
} from "../db/pool.js";

import {
  requireAuth,
} from "../middleware/auth.js";


const router =
  Router();


function cleanColorName(
  value:unknown,
) {

  return String(
    value ?? "",
  ).trim();

}


router.get(
  "/",
  requireAuth,
  async (_req,res) => {

    try {

      const result =
        await pool.query(
          `
            SELECT
              c.id,
              c.name,
              c.active,
              c.created_at,

              COUNT(w.id)::int
                AS usage_count

            FROM colors c

            LEFT JOIN works w
              ON w.color_id = c.id

            GROUP BY
              c.id,
              c.name,
              c.active,
              c.created_at

            ORDER BY
              c.active DESC,
              LOWER(c.name),
              c.id
          `,
        );


      return res.json(
        result.rows,
      );


    } catch(error) {

      console.error(
        "Colors load failed",
        error,
      );


      return res.status(500).json({
        error:"colors_load_failed",
      });

    }

  },
);


router.post(
  "/",
  requireAuth,
  async (req,res) => {

    const name =
      cleanColorName(
        req.body?.name,
      );


    if(!name) {

      return res.status(400).json({
        error:"missing_name",
      });

    }


    if(name.length > 120) {

      return res.status(400).json({
        error:"name_too_long",
      });

    }


    try {

      const result =
        await pool.query(
          `
            INSERT INTO colors(
              name
            )
            VALUES($1)

            RETURNING
              id,
              name,
              active,
              created_at,
              0::int AS usage_count
          `,
          [name],
        );


      return res
        .status(201)
        .json(
          result.rows[0],
        );


    } catch(error:any) {

      if(error?.code === "23505") {

        return res.status(409).json({
          error:"color_name_exists",
        });

      }


      console.error(
        "Color creation failed",
        error,
      );


      return res.status(500).json({
        error:"color_creation_failed",
      });

    }

  },
);


router.put(
  "/:id",
  requireAuth,
  async (req,res) => {

    const colorId =
      Number(
        req.params.id,
      );

    const name =
      cleanColorName(
        req.body?.name,
      );


    if(
      !Number.isInteger(colorId) ||
      colorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_color_id",
      });

    }


    if(!name) {

      return res.status(400).json({
        error:"missing_name",
      });

    }


    if(name.length > 120) {

      return res.status(400).json({
        error:"name_too_long",
      });

    }


    try {

      const result =
        await pool.query(
          `
            UPDATE colors
            SET name = $1
            WHERE id = $2

            RETURNING
              id,
              name,
              active,
              created_at,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE color_id = colors.id
              ) AS usage_count
          `,
          [
            name,
            colorId,
          ],
        );


      if(result.rowCount === 0) {

        return res.status(404).json({
          error:"color_not_found",
        });

      }


      return res.json(
        result.rows[0],
      );


    } catch(error:any) {

      if(error?.code === "23505") {

        return res.status(409).json({
          error:"color_name_exists",
        });

      }


      console.error(
        "Color update failed",
        error,
      );


      return res.status(500).json({
        error:"color_update_failed",
      });

    }

  },
);


router.patch(
  "/:id/status",
  requireAuth,
  async (req,res) => {

    const colorId =
      Number(
        req.params.id,
      );


    if(
      !Number.isInteger(colorId) ||
      colorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_color_id",
      });

    }


    if(
      typeof req.body?.active
      !== "boolean"
    ) {

      return res.status(400).json({
        error:"invalid_status",
      });

    }


    try {

      const result =
        await pool.query(
          `
            UPDATE colors
            SET active = $1
            WHERE id = $2

            RETURNING
              id,
              name,
              active,
              created_at,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE color_id = colors.id
              ) AS usage_count
          `,
          [
            req.body.active,
            colorId,
          ],
        );


      if(result.rowCount === 0) {

        return res.status(404).json({
          error:"color_not_found",
        });

      }


      return res.json(
        result.rows[0],
      );


    } catch(error) {

      console.error(
        "Color status update failed",
        error,
      );


      return res.status(500).json({
        error:"color_status_update_failed",
      });

    }

  },
);


router.delete(
  "/:id",
  requireAuth,
  async (req,res) => {

    const colorId =
      Number(
        req.params.id,
      );


    if(
      !Number.isInteger(colorId) ||
      colorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_color_id",
      });

    }


    try {

      const color =
        await pool.query(
          `
            SELECT
              id,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE color_id = colors.id
              ) AS usage_count

            FROM colors

            WHERE id = $1
          `,
          [colorId],
        );


      if(color.rowCount === 0) {

        return res.status(404).json({
          error:"color_not_found",
        });

      }


      if(
        Number(
          color.rows[0].usage_count,
        ) > 0
      ) {

        return res.status(409).json({
          error:"color_in_use",
        });

      }


      await pool.query(
        `
          DELETE FROM colors
          WHERE id = $1
        `,
        [colorId],
      );


      return res.json({
        status:"deleted",
      });


    } catch(error) {

      console.error(
        "Color deletion failed",
        error,
      );


      return res.status(500).json({
        error:"color_deletion_failed",
      });

    }

  },
);


export {
  router as colorsRouter,
};
