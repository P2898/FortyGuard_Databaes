CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('demo','live') NOT NULL,
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	`startDate` varchar(32) NOT NULL,
	`startTime` varchar(16) NOT NULL,
	`thresholdC` decimal(6,2) NOT NULL,
	`siteCount` int NOT NULL,
	`criticalCount` int NOT NULL,
	`highCount` int NOT NULL,
	`anomalyCount` int NOT NULL,
	`complianceCount` int NOT NULL,
	`summary` text,
	`sitesJson` json NOT NULL,
	`resultsJson` json NOT NULL,
	`flagsJson` json NOT NULL,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
