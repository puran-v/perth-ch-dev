import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName = body?.fullName?.trim();
    const email = body?.email?.trim()?.toLowerCase();
    const password = body?.password;

    // Basic validation
    if (!fullName || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "fullName, email, and password are required",
          },
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message: "Password must be at least 8 characters",
          },
        },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "Email already registered",
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/signup]", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create account",
        },
      },
      { status: 500 }
    );
  }
}
