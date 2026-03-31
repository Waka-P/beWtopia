import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { BewtsForm } from "../BewtsForm";
import NewBewtsButton from "../NewBewtsButton";
import styles from "../Projects.module.scss";

export const metadata: Metadata = {
  title: "ビューズ - 募集",
};

export default async function NewBewtsPage() {
  const skills = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <>
      <NewBewtsButton current="new" />
      <div className={styles.topRow}>
        <Link href="/bewts" className={styles.trail}>
          <span className={styles.trailArrow}>&#9664;</span>
          募集中プロジェクト一覧
        </Link>
      </div>
      <BewtsForm skills={skills} />
    </>
  );
}
