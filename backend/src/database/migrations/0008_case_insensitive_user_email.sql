CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));
