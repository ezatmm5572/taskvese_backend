import mongoose from "mongoose";
import { hashSync } from "bcrypt";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Load configuration
const env = process.env.NODE_ENV || "development";
const envPath = env === "production" ? ".production" : ".development";
const resolvedEnv = resolve(`config/.env${envPath}`);
if (existsSync(resolvedEnv)) {
    dotenv.config({ path: resolvedEnv });
} else {
    dotenv.config();
}

import memberModel from "./models/member.js";
import teamModel from "./models/team.js";
import taskModel from "./models/task.js";
import taskAssignmentModel from "./models/taskAssignment.js";
import commentModel from "./models/comment.js";
import timeEntryModel from "./models/timeEntry.js";
import { RoleEnum, GenderEnum, ProviderEnum } from "../commn/enums/member.enums.js";
import { TaskStatusEnum } from "../commn/enums/task.enums.js";

const DB_URI = process.env.DB_URI || "mongodb://127.0.0.1:27017/taskManagementSystem";
const HASH_SALT = Number(process.env.HASH_SALT) || 12;

export const seedDatabase = async () => {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(DB_URI);
    console.log("Connected to MongoDB.");

    const defaultPassword = "TaskVerse@2026!";
    const passwordHash = hashSync(defaultPassword, HASH_SALT);

    console.log("Seeding members...");
    // 1 Admin + 7 Members
    const membersData = [
        {
            fname: "System",
            lname: "Admin",
            email: "admin@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.MALE,
            role: RoleEnum.ADMIN,
            confirmed: true,
            active: true,
        },
        {
            fname: "Alice",
            lname: "Smith",
            email: "alice.smith@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.FEMALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "Bob",
            lname: "Jones",
            email: "bob.jones@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.MALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "Carol",
            lname: "White",
            email: "carol.white@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.FEMALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "David",
            lname: "Brown",
            email: "david.brown@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.MALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "Eva",
            lname: "Green",
            email: "eva.green@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.FEMALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "Frank",
            lname: "Wright",
            email: "frank.wright@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.MALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
        {
            fname: "Grace",
            lname: "Hopper",
            email: "grace.hopper@taskverse.com",
            password: passwordHash,
            gender: GenderEnum.FEMALE,
            role: RoleEnum.MEMBER,
            confirmed: true,
            active: true,
        },
    ];

    const memberDocs = {};
    for (const data of membersData) {
        let member = await memberModel.findOne({ email: data.email });
        if (!member) {
            member = await memberModel.create(data);
        } else {
            member.password = data.password;
            member.confirmed = true;
            member.active = true;
            await member.save();
        }
        memberDocs[data.email] = member;
    }
    console.log(`Seeded ${Object.keys(memberDocs).length} members.`);

    // 2 Teams
    console.log("Seeding teams...");
    const adminUser = memberDocs["admin@taskverse.com"];
    const alice = memberDocs["alice.smith@taskverse.com"];
    const bob = memberDocs["bob.jones@taskverse.com"];
    const carol = memberDocs["carol.white@taskverse.com"];
    const david = memberDocs["david.brown@taskverse.com"];
    const eva = memberDocs["eva.green@taskverse.com"];
    const frank = memberDocs["frank.wright@taskverse.com"];
    const grace = memberDocs["grace.hopper@taskverse.com"];

    // Team 1: Core Engineering
    let coreTeam = await teamModel.findOne({ name: "Core Engineering" });
    if (!coreTeam) {
        coreTeam = await teamModel.create({
            name: "Core Engineering",
            addedBy: adminUser._id,
            teamAdims: [alice._id],
            teamMembers: [alice._id, bob._id, carol._id, david._id, eva._id, frank._id],
        });
    }

    // Team 2: Product & Design
    let designTeam = await teamModel.findOne({ name: "Product & Design" });
    if (!designTeam) {
        designTeam = await teamModel.create({
            name: "Product & Design",
            addedBy: adminUser._id,
            teamAdims: [adminUser._id],
            teamMembers: [adminUser._id, alice._id, frank._id, grace._id],
        });
    }

    // Update members teams array
    await memberModel.updateOne(
        { _id: alice._id },
        {
            $set: {
                teams: [
                    { teamId: coreTeam._id, role: "admin" },
                    { teamId: designTeam._id, role: "editor" },
                ],
            },
        }
    );
    await memberModel.updateOne(
        { _id: bob._id },
        { $set: { teams: [{ teamId: coreTeam._id, role: "editor" }] } }
    );
    await memberModel.updateOne(
        { _id: carol._id },
        { $set: { teams: [{ teamId: coreTeam._id, role: "editor" }] } }
    );
    await memberModel.updateOne(
        { _id: david._id },
        { $set: { teams: [{ teamId: coreTeam._id, role: "editor" }] } }
    );
    await memberModel.updateOne(
        { _id: eva._id },
        { $set: { teams: [{ teamId: coreTeam._id, role: "editor" }] } }
    );
    // Frank is a Viewer in Core Engineering!
    await memberModel.updateOne(
        { _id: frank._id },
        {
            $set: {
                teams: [
                    { teamId: coreTeam._id, role: "viewer" },
                    { teamId: designTeam._id, role: "editor" },
                ],
            },
        }
    );
    await memberModel.updateOne(
        { _id: grace._id },
        { $set: { teams: [{ teamId: designTeam._id, role: "editor" }] } }
    );

    console.log("Seeding sample tasks...");
    let sampleTask1 = await taskModel.findOne({ title: "Setup CI/CD Pipeline & Staging Deployments" });
    if (!sampleTask1) {
        sampleTask1 = await taskModel.create({
            title: "Setup CI/CD Pipeline & Staging Deployments",
            description: "Configure GitHub Actions workflows to build, test, and deploy backend to Vercel/Render staging environments on each pull request.",
            startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
            team: coreTeam._id,
            createdBy: alice._id,
            priority: "high",
            tags: ["devops", "ci-cd", "infrastructure"],
            subtasks: [
                { text: "Write GitHub Actions workflow file", done: true },
                { text: "Configure secrets in repository settings", done: true },
                { text: "Add Playwright E2E test step", done: false },
            ],
            estimateMin: 240,
        });

        await taskAssignmentModel.create({
            task: sampleTask1._id,
            member: bob._id,
            assignedBy: alice._id,
            status: TaskStatusEnum.IN_PROGRESS,
        });

        await commentModel.create({
            task: sampleTask1._id,
            author: alice._id,
            text: "Hey @BobJones, let me know if you need Cloudinary or Redis staging credentials.",
            mentions: [bob._id],
        });

        await timeEntryModel.create({
            task: sampleTask1._id,
            author: bob._id,
            minutes: 90,
            note: "Drafted workflow and tested build matrix",
            at: new Date(),
        });
    }

    let sampleTask2 = await taskModel.findOne({ title: "Design System Tokens & Dark Mode Audit" });
    if (!sampleTask2) {
        sampleTask2 = await taskModel.create({
            title: "Design System Tokens & Dark Mode Audit",
            description: "Audit color contrast, responsive typography scales, and CSS variables across all UI modal and sidebar components.",
            startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
            team: designTeam._id,
            createdBy: adminUser._id,
            priority: "medium",
            tags: ["ui", "design", "tokens"],
            subtasks: [
                { text: "Audit modal dialogs color contrast", done: false },
                { text: "Verify mobile navigation drawer", done: false },
            ],
            estimateMin: 180,
        });

        await taskAssignmentModel.create({
            task: sampleTask2._id,
            member: frank._id,
            assignedBy: adminUser._id,
            status: TaskStatusEnum.TODO,
        });
    }

    console.log("Seeding complete! Summary:");
    console.log("=================================================");
    console.log("Admin account : admin@taskverse.com / TaskVerse@2026!");
    console.log("Members (6+)  : alice.smith@taskverse.com (Core Eng Admin)");
    console.log("                bob.jones@taskverse.com (Core Eng Editor)");
    console.log("                carol.white@taskverse.com (Core Eng Editor)");
    console.log("                david.brown@taskverse.com (Core Eng Editor)");
    console.log("                eva.green@taskverse.com (Core Eng Editor)");
    console.log("                frank.wright@taskverse.com (Core Eng Viewer, Design Editor)");
    console.log("                grace.hopper@taskverse.com (Design Editor)");
    console.log("Teams (2)     : Core Engineering, Product & Design");
    console.log("=================================================");

    await mongoose.disconnect();
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    seedDatabase().catch((err) => {
        console.error("Seeding failed:", err);
        process.exit(1);
    });
}
