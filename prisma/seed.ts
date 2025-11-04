import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (in reverse order of dependencies)
  console.log("🗑️  Clearing existing data...");
  await prisma.classBook.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.studentAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.studentBook.deleteMany();
  await prisma.book.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.librarian.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  console.log("👤 Creating users...");

  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@readingbuddy.com",
      name: "Principal Johnson",
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  });

  await prisma.admin.create({
    data: {
      userId: adminUser.id,
      schoolId: "SCHOOL-001",
    },
  });

  // Librarian User
  const librarianUser = await prisma.user.create({
    data: {
      email: "librarian@readingbuddy.com",
      name: "Ms. Sarah Martinez",
      role: UserRole.LIBRARIAN,
      emailVerified: new Date(),
    },
  });

  await prisma.librarian.create({
    data: {
      userId: librarianUser.id,
      schoolId: "SCHOOL-001",
    },
  });

  // Teacher Users
  const teacher1User = await prisma.user.create({
    data: {
      email: "teacher1@readingbuddy.com",
      name: "Mr. David Chen",
      role: UserRole.TEACHER,
      emailVerified: new Date(),
    },
  });

  const teacher1 = await prisma.teacher.create({
    data: {
      userId: teacher1User.id,
      schoolId: "SCHOOL-001",
    },
  });

  const teacher2User = await prisma.user.create({
    data: {
      email: "teacher2@readingbuddy.com",
      name: "Mrs. Emily Rodriguez",
      role: UserRole.TEACHER,
      emailVerified: new Date(),
    },
  });

  const teacher2 = await prisma.teacher.create({
    data: {
      userId: teacher2User.id,
      schoolId: "SCHOOL-001",
    },
  });

  // Student Users
  const studentData = [
    { email: "alice@student.com", name: "Alice Johnson", grade: "5" },
    { email: "bob@student.com", name: "Bob Smith", grade: "5" },
    { email: "charlie@student.com", name: "Charlie Brown", grade: "6" },
    { email: "diana@student.com", name: "Diana Prince", grade: "6" },
    { email: "ethan@student.com", name: "Ethan Hunt", grade: "7" },
    { email: "fiona@student.com", name: "Fiona Apple", grade: "7" },
  ];

  const students = [];
  for (const data of studentData) {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: UserRole.STUDENT,
        emailVerified: new Date(),
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        grade: data.grade,
        points: Math.floor(Math.random() * 500),
      },
    });

    students.push(student);
  }

  console.log(`✅ Created ${students.length} students`);

  // Create Books
  console.log("📚 Creating books...");

  const books = await Promise.all([
    prisma.book.create({
      data: {
        title: "The Adventure Begins",
        author: "John Smith",
        publisher: "Adventure Press",
        year: 2020,
        isbn: "978-0-1234-5678-0",
        description: "An exciting tale of courage and friendship as young heroes embark on their first quest.",
        category: "Adventure",
        grade: "5",
        pdfUrl: "/books/adventure-begins.pdf",
        coverUrl: "/covers/adventure-begins.jpg",
        pageCount: 120,
      },
    }),
    prisma.book.create({
      data: {
        title: "Science Explorers",
        author: "Dr. Emily Watson",
        publisher: "STEM Publishers",
        year: 2021,
        isbn: "978-0-1234-5678-1",
        description: "Discover the wonders of science through hands-on experiments and fascinating facts.",
        category: "Science",
        grade: "6",
        pdfUrl: "/books/science-explorers.pdf",
        coverUrl: "/covers/science-explorers.jpg",
        pageCount: 95,
      },
    }),
    prisma.book.create({
      data: {
        title: "Mystery at Midnight",
        author: "Sarah Detective",
        publisher: "Mystery House",
        year: 2019,
        isbn: "978-0-1234-5678-2",
        description: "A thrilling mystery that will keep you guessing until the very last page.",
        category: "Mystery",
        grade: "7",
        pdfUrl: "/books/mystery-midnight.pdf",
        coverUrl: "/covers/mystery-midnight.jpg",
        pageCount: 150,
      },
    }),
    prisma.book.create({
      data: {
        title: "Space Voyagers",
        author: "Captain Alex Star",
        publisher: "Galaxy Books",
        year: 2022,
        isbn: "978-0-1234-5678-3",
        description: "Journey through the cosmos and explore distant planets in this space adventure.",
        category: "Science Fiction",
        grade: "6",
        pdfUrl: "/books/space-voyagers.pdf",
        coverUrl: "/covers/space-voyagers.jpg",
        pageCount: 110,
      },
    }),
    prisma.book.create({
      data: {
        title: "The Magic Garden",
        author: "Luna Greenthumb",
        publisher: "Fantasy Tales",
        year: 2021,
        isbn: "978-0-1234-5678-4",
        description: "A magical story about a secret garden where plants can talk and magic is real.",
        category: "Fantasy",
        grade: "5",
        pdfUrl: "/books/magic-garden.pdf",
        coverUrl: "/covers/magic-garden.jpg",
        pageCount: 88,
      },
    }),
  ]);

  console.log(`✅ Created ${books.length} books`);

  // Create Achievements
  console.log("🏆 Creating achievements...");

  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        name: "First Steps",
        description: "Read your first book",
        badgeUrl: "/badges/first-steps.png",
        criteria: { type: "books_read", count: 1 },
        points: 10,
      },
    }),
    prisma.achievement.create({
      data: {
        name: "Book Worm",
        description: "Read 5 books",
        badgeUrl: "/badges/book-worm.png",
        criteria: { type: "books_read", count: 5 },
        points: 50,
      },
    }),
    prisma.achievement.create({
      data: {
        name: "Quiz Master",
        description: "Score 90% or higher on a quiz",
        badgeUrl: "/badges/quiz-master.png",
        criteria: { type: "quiz_score", score: 90 },
        points: 25,
      },
    }),
    prisma.achievement.create({
      data: {
        name: "Speed Reader",
        description: "Complete a book in one day",
        badgeUrl: "/badges/speed-reader.png",
        criteria: { type: "books_completed_same_day", count: 1 },
        points: 30,
      },
    }),
    prisma.achievement.create({
      data: {
        name: "Library Legend",
        description: "Read 10 books",
        badgeUrl: "/badges/library-legend.png",
        criteria: { type: "books_read", count: 10 },
        points: 100,
      },
    }),
  ]);

  console.log(`✅ Created ${achievements.length} achievements`);

  // Create Classes
  console.log("🏫 Creating classes...");

  const class5A = await prisma.class.create({
    data: {
      teacherId: teacher1.id,
      name: "5A - Reading Champions",
      grade: "5",
    },
  });

  const class6B = await prisma.class.create({
    data: {
      teacherId: teacher2.id,
      name: "6B - Book Explorers",
      grade: "6",
    },
  });

  const class7C = await prisma.class.create({
    data: {
      teacherId: teacher1.id,
      name: "7C - Literature Masters",
      grade: "7",
    },
  });

  console.log("✅ Created 3 classes");

  // Assign students to classes
  console.log("👥 Assigning students to classes...");

  // Class 5A - Alice and Bob
  await prisma.classStudent.create({
    data: { classId: class5A.id, studentId: students[0].id },
  });
  await prisma.classStudent.create({
    data: { classId: class5A.id, studentId: students[1].id },
  });

  // Class 6B - Charlie and Diana
  await prisma.classStudent.create({
    data: { classId: class6B.id, studentId: students[2].id },
  });
  await prisma.classStudent.create({
    data: { classId: class6B.id, studentId: students[3].id },
  });

  // Class 7C - Ethan and Fiona
  await prisma.classStudent.create({
    data: { classId: class7C.id, studentId: students[4].id },
  });
  await prisma.classStudent.create({
    data: { classId: class7C.id, studentId: students[5].id },
  });

  console.log("✅ Assigned students to classes");

  // Assign books to classes
  console.log("📖 Assigning books to classes...");

  // Class 5A gets Adventure and Magic Garden books
  await prisma.classBook.create({
    data: {
      classId: class5A.id,
      bookId: books[0].id, // Adventure Begins
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });
  await prisma.classBook.create({
    data: {
      classId: class5A.id,
      bookId: books[4].id, // Magic Garden
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Class 6B gets Science and Space books
  await prisma.classBook.create({
    data: {
      classId: class6B.id,
      bookId: books[1].id, // Science Explorers
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.classBook.create({
    data: {
      classId: class6B.id,
      bookId: books[3].id, // Space Voyagers
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Class 7C gets Mystery book
  await prisma.classBook.create({
    data: {
      classId: class7C.id,
      bookId: books[2].id, // Mystery at Midnight
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Assigned books to classes");

  // Create sample reading progress
  console.log("📊 Creating sample reading progress...");

  // Alice is reading Adventure Begins
  await prisma.studentBook.create({
    data: {
      studentId: students[0].id,
      bookId: books[0].id,
      currentPage: 45,
      completed: false,
    },
  });

  // Bob completed Magic Garden
  await prisma.studentBook.create({
    data: {
      studentId: students[1].id,
      bookId: books[4].id,
      currentPage: 88,
      completed: true,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
  });

  // Charlie is reading Science Explorers
  await prisma.studentBook.create({
    data: {
      studentId: students[2].id,
      bookId: books[1].id,
      currentPage: 60,
      completed: false,
    },
  });

  console.log("✅ Created sample reading progress");

  // Award some achievements
  console.log("🎖️ Awarding achievements...");

  // Bob gets "First Steps" achievement for completing a book
  await prisma.studentAchievement.create({
    data: {
      studentId: students[1].id,
      achievementId: achievements[0].id,
      earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // Update Bob's points
  await prisma.student.update({
    where: { id: students[1].id },
    data: { points: { increment: achievements[0].points } },
  });

  console.log("✅ Awarded achievements");

  // Create sample quizzes
  console.log("❓ Creating sample quizzes...");

  const quiz1 = await prisma.quiz.create({
    data: {
      bookId: books[0].id, // Adventure Begins
      generatedBy: "AI",
      questions: [
        {
          question: "What is the main character's name?",
          options: ["Alex", "Sam", "Jordan", "Casey"],
          correctAnswer: 0,
        },
        {
          question: "Where does the adventure begin?",
          options: ["School", "Forest", "Castle", "Beach"],
          correctAnswer: 1,
        },
        {
          question: "What lesson did the characters learn?",
          options: ["Honesty", "Courage", "Friendship", "All of the above"],
          correctAnswer: 3,
        },
      ],
    },
  });

  const quiz2 = await prisma.quiz.create({
    data: {
      bookId: books[4].id, // Magic Garden
      generatedBy: "AI",
      questions: [
        {
          question: "What makes the garden special?",
          options: ["Golden flowers", "Talking plants", "Giant trees", "Rainbow colors"],
          correctAnswer: 1,
        },
        {
          question: "Who discovers the garden?",
          options: ["A teacher", "A student", "A gardener", "A scientist"],
          correctAnswer: 1,
        },
      ],
    },
  });

  // Bob completed a quiz
  await prisma.quizAttempt.create({
    data: {
      studentId: students[1].id,
      quizId: quiz2.id,
      answers: [1, 1], // Both correct
      score: 100,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
  });

  console.log("✅ Created sample quizzes");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📋 Summary:");
  console.log("   - 1 Admin");
  console.log("   - 1 Librarian");
  console.log("   - 2 Teachers");
  console.log(`   - ${students.length} Students`);
  console.log(`   - ${books.length} Books`);
  console.log(`   - ${achievements.length} Achievements`);
  console.log("   - 3 Classes");
  console.log("   - 2 Quizzes");
  console.log("\n🔐 Login credentials:");
  console.log("   Admin: admin@readingbuddy.com");
  console.log("   Librarian: librarian@readingbuddy.com");
  console.log("   Teacher 1: teacher1@readingbuddy.com");
  console.log("   Teacher 2: teacher2@readingbuddy.com");
  console.log("   Student: alice@student.com (or any other student email)");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
