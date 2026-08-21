ALTER TABLE `assessments` ADD `industry` varchar(120) DEFAULT 'Industrial operations' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessments` ADD `operationalContext` text;--> statement-breakpoint
ALTER TABLE `assessments` ADD `actionsJson` json NOT NULL;