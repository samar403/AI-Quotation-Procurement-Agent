// Resets the local workspace to the demo data: `npm run seed`.
import { resetDemo } from "../src/lib/services";

const db = await resetDemo();
console.log(`Seeded ${db.suppliers.length} suppliers, ${db.orders.length} orders and ${db.quotes.length} quotations into .data/db.json`);
