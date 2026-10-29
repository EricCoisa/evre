-- AddForeignKey
ALTER TABLE "proposal_open_events" ADD CONSTRAINT "proposal_open_events_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
