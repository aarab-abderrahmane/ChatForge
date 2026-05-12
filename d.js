Below is a **ready-to-use Next.js (App Router) + MongoDB (Mongoose) implementation** organized as real project files.

---

# 📁 1. MongoDB Connection

### `lib/mongodb.js`

```js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

---

# 📁 2. Player Model

### `models/Joueur.js`

```js
import mongoose from "mongoose";

const joueurSchema = new mongoose.Schema(
  {
    id: Number,
    idEquipe: Number,
    nom: String,
    numero: Number,
    poste: String,
  },
  { timestamps: true }
);

export default mongoose.models.Joueur ||
  mongoose.model("Joueur", joueurSchema);
```

---

# 📁 3. Team Model (needed for relation)

### `models/Equipe.js`

```js
import mongoose from "mongoose";

const equipeSchema = new mongoose.Schema(
  {
    id: Number,
    nom: String,
  },
  { timestamps: true }
);

export default mongoose.models.Equipe ||
  mongoose.model("Equipe", equipeSchema);
```

---

# 📁 4. CRUD API (Players)

### `app/api/joueurs/route.js`

```js
import { connectDB } from "@/lib/mongodb";
import Joueur from "@/models/Joueur";

// GET all players
export async function GET() {
  await connectDB();
  const joueurs = await Joueur.find();
  return Response.json(joueurs);
}

// CREATE player
export async function POST(req) {
  await connectDB();
  const data = await req.json();

  const joueur = await Joueur.create(data);
  return Response.json(joueur);
}
```

---

# 📁 5. Player by ID (GET / PUT / DELETE)

### `app/api/joueurs/[id]/route.js`

```js
import { connectDB } from "@/lib/mongodb";
import Joueur from "@/models/Joueur";

// GET one player
export async function GET(req, { params }) {
  await connectDB();
  const joueur = await Joueur.findById(params.id);
  return Response.json(joueur);
}

// UPDATE player
export async function PUT(req, { params }) {
  await connectDB();
  const data = await req.json();

  const updated = await Joueur.findByIdAndUpdate(params.id, data, {
    new: true,
  });

  return Response.json(updated);
}

// DELETE player
export async function DELETE(req, { params }) {
  await connectDB();
  await Joueur.findByIdAndDelete(params.id);

  return Response.json({ message: "Deleted successfully" });
}
```

---

# 📁 6. Get Players by Team ID

### `app/api/equipes/[idEquipe]/joueurs/route.js`

```js
import { connectDB } from "@/lib/mongodb";
import Joueur from "@/models/Joueur";

export async function GET(req, { params }) {
  await connectDB();

  const joueurs = await Joueur.find({ idEquipe: params.idEquipe });

  return Response.json(joueurs);
}
```

---

# 📁 7. Get Team of a Player

### `app/api/joueurs/[id]/equipe/route.js`

```js
import { connectDB } from "@/lib/mongodb";
import Joueur from "@/models/Joueur";
import Equipe from "@/models/Equipe";

export async function GET(req, { params }) {
  await connectDB();

  const joueur = await Joueur.findById(params.id);
  if (!joueur) {
    return Response.json({ message: "Player not found" }, { status: 404 });
  }

  const equipe = await Equipe.findOne({ id: joueur.idEquipe });

  return Response.json(equipe);
}
```

---

# 📁 8. Search Player by Name

### `app/api/joueurs/search/route.js`

```js
import { connectDB } from "@/lib/mongodb";
import Joueur from "@/models/Joueur";

export async function GET(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const nom = searchParams.get("nom");

  const result = await Joueur.find({
    nom: { $regex: nom, $options: "i" },
  });

  return Response.json(result);
}
```

---

# ✅ Summary of Routes

### CRUD

* GET `/api/joueurs`
* POST `/api/joueurs`
* GET `/api/joueurs/:id`
* PUT `/api/joueurs/:id`
* DELETE `/api/joueurs/:id`

### Extra

* GET `/api/equipes/:idEquipe/joueurs`
* GET `/api/joueurs/:id/equipe`
* GET `/api/joueurs/search?nom=xxx`

---

If you want, I can also generate:

* a **React frontend (Next.js pages)**
* a **Postman collection**
* or a **ready GitHub project structure**

Just tell me.
