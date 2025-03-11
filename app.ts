import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";

import { z } from "zod";

interface Rental {
	id: number;
	title: string;
	location: string;
	price: number;
	bedrooms: number;
	bathrooms: number;
	property_type: string;
	description: string;
	image: string;
}

interface Tenant {
	id: number;
	firstname: string;
	lastname: string;
	email: string;
	password: string;
	age: number;
	rental_id: number;
}

const createRentalSchema = z.object({
	title: z.string().min(1, "Please add a title"),
	location: z.string().min(1, "Please add a location"),
	price: z.number().positive("Price needs to be greater than zero"),
	bedrooms: z
		.number()
		.int()
		.nonnegative("Number of bedrooms can't be negative"),
	bathrooms: z.number().nonnegative("Number of bathrooms can't be negative"),
	property_type: z.enum(["house", "apartment"], {
		message: "Please select either house or apartment",
	}),
	description: z.string(),
	image: z.string().url("Please provide a valid image url"),
});

const updateRentalSchema = createRentalSchema.partial();

const paramsIdSchema = z.object({
	id: z
		.string()
		.transform((val) => Number.parseInt(val, 10))
		.pipe(z.number().int().positive("ID must be a positive integer")),
});

const rentalTypeSchema = z.object({
	type: z.enum(["house", "apartment"]).optional(),
});

interface Data {
	rentals: Rental[];
	tenants: Tenant[];
}

const dataPath = path.join(__dirname, "data.json");
const rawData = fs.readFileSync(dataPath, "utf8");
const data: Data = JSON.parse(rawData);

const app = express();
const port = 3000;

app.use(express.json());

// Get all rentals with optional property type filter
app.get("/rentals", (req: Request, res: Response) => {
	try {
		const { type } = rentalTypeSchema.parse(req.query);

		const rentals = type
			? data.rentals.filter((rental) => rental.property_type === type)
			: data.rentals;

		res.status(200).json(rentals);
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: "Invalid query parameters",
				message: "Invalid property type. Must be 'house' or 'apartment'.",
				validOptions: ["house", "apartment"],
			});
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// Get all tenants
app.get("/tenants", (req: Request, res: Response) => {
	try {
		res.status(200).json(data.tenants);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});

// Get all tenants of a rental
app.get("/rentals/:id/tenants", (req: Request, res: Response) => {
	try {
		const { id } = z
			.object({
				id: z
					.string()
					.transform((val) => Number.parseInt(val, 10))
					.pipe(
						z.number().int().positive("Rental ID must be a positive integer"),
					),
			})
			.parse(req.params);

		const tenants = data.tenants.filter((tenant) => tenant.rental_id === id);

		res.status(200).json(tenants);
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: "Invalid rental ID",
				message: "Rental ID must be a positive integer",
			});
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// Create a new rental
app.post("/rentals", (req: Request, res: Response) => {
	try {
		const {
			title,
			location,
			price,
			bedrooms,
			bathrooms,
			property_type,
			description,
			image,
		} = createRentalSchema.parse(req.body);

		const newRental: Rental = {
			id: data.rentals.length + 1,
			title,
			location,
			price,
			bedrooms,
			bathrooms,
			property_type,
			description,
			image,
		};

		data.rentals.push(newRental);

		res.status(201).json(newRental);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const formattedErrors = error.errors.map((err) => ({
				field: err.path.join("."),
				message: err.message,
			}));

			res.status(400).json({
				error: "Invalid rental data",
				message: "Please check the provided data and fix the validation errors",
				details: formattedErrors,
			});
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// Update a rental
app.patch("/rentals/:id", (req: Request, res: Response) => {
	try {
		const { id } = paramsIdSchema.parse(req.params);
		const validatedData = updateRentalSchema.parse(req.body);
		const rentalIndex = data.rentals.findIndex((rental) => rental.id === id);

		if (rentalIndex === -1) {
			res.status(404).json({ error: "Rental not found" });
			return;
		}

		const updatedRental = {
			...data.rentals[rentalIndex],
			...validatedData,
		};

		data.rentals[rentalIndex] = updatedRental;

		res.status(200).json(updatedRental);
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: "Invalid rental data",
				message: "Please check the provided data and fix the validation errors",
				details: error.errors,
			});
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// Delete a rental, also handles 404
app.delete("/rentals/:id", (req: Request, res: Response) => {
	try {
		const { id } = paramsIdSchema.parse(req.params);

		const rentalIndex = data.rentals.findIndex((rental) => rental.id === id);

		if (rentalIndex === -1) {
			res.status(404).json({ error: "Rental not found" });
			return;
		}

		data.rentals.splice(rentalIndex, 1);

		res.status(200).send();
	} catch (error) {
		if (error instanceof z.ZodError) {
			res
				.status(400)
				.json({ error: "Invalid rental ID", message: error.message });
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// Start the server
app.listen(port, () => {
	console.log(`[server]: Server is running at http://localhost:${port}`);
});
