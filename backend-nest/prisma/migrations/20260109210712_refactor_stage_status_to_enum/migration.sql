-- Safe migration for Stage.status to enum
-- This migration handles the case where the enum might already exist

-- Step 1: Create enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StageStatus') THEN
        CREATE TYPE "StageStatus" AS ENUM ('TODO', 'DOING', 'DONE');
    END IF;
END $$;

-- Step 2: Determine current state and handle accordingly
DO $$ 
DECLARE
    status_column_type TEXT;
    status_new_exists BOOLEAN;
BEGIN
    -- Get the current data type of the status column
    SELECT data_type INTO status_column_type
    FROM information_schema.columns 
    WHERE table_name = 'stages' AND column_name = 'status';
    
    -- Check if status_new column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stages' AND column_name = 'status_new'
    ) INTO status_new_exists;

    -- If status is already the enum type and status_new exists, just clean up
    IF status_column_type = 'USER-DEFINED' AND status_new_exists THEN
        -- Status is already enum, drop status_new if it exists
        ALTER TABLE "stages" DROP COLUMN IF EXISTS "status_new";
        
    -- If status is not enum type yet
    ELSIF status_column_type != 'USER-DEFINED' THEN
        -- Add temporary column if it doesn't exist
        IF NOT status_new_exists THEN
            ALTER TABLE "stages" ADD COLUMN "status_new" "StageStatus" NOT NULL DEFAULT 'TODO';
        END IF;
        
        -- Migrate data
        UPDATE "stages" 
        SET "status_new" = CASE 
            WHEN UPPER("status"::text) = 'TODO' THEN 'TODO'::"StageStatus"
            WHEN UPPER("status"::text) = 'DOING' THEN 'DOING'::"StageStatus"
            WHEN UPPER("status"::text) = 'DONE' THEN 'DONE'::"StageStatus"
            WHEN UPPER("status"::text) = 'IN_PROGRESS' THEN 'DOING'::"StageStatus"
            WHEN UPPER("status"::text) = 'PENDING' THEN 'TODO'::"StageStatus"
            WHEN UPPER("status"::text) = 'COMPLETED' THEN 'DONE'::"StageStatus"
            WHEN UPPER("status"::text) = 'FINISHED' THEN 'DONE'::"StageStatus"
            ELSE 'TODO'::"StageStatus"
        END;
        
        -- Drop old column and rename
        ALTER TABLE "stages" DROP COLUMN "status";
        ALTER TABLE "stages" RENAME COLUMN "status_new" TO "status";
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS "stages_status_idx" ON "stages"("status");

