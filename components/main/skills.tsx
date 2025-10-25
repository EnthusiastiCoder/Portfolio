import { SkillDataProvider } from "@/components/sub/skill-data-provider";
import { SkillText } from "@/components/sub/skill-text";

import {
  BACKEND_SKILL,
  FRONTEND_SKILL,
  OTHER_SKILL,
  LANGUAGES_SKILL,
  DEVOPS_SKILL,
} from "@/constants";

export const Skills = () => {
  return (
    <section
      id="skills"
      style={{ transform: "scale(0.9)" }}
      className="flex flex-col items-center justify-center gap-3 h-full relative overflow-hidden py-10"
    >
      <SkillText />

      {/* Languages row */}
      <div className="w-full mt-6">
        <h3 className="text-sm md:text-base text-gray-300/80 mb-3 text-center">Languages</h3>
        <div className="flex flex-row justify-center flex-wrap gap-6 items-center">
          {LANGUAGES_SKILL.map((skill, i) => (
            <SkillDataProvider
              key={skill.skill_name}
              src={skill.image}
              name={skill.skill_name}
              width={skill.width}
              height={skill.height}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Frontend row */}
      <div className="w-full mt-6">
        <h3 className="text-sm md:text-base text-gray-300/80 mb-3 text-center">Frontend</h3>
        <div className="flex flex-row justify-center flex-wrap gap-6 items-center">
          {FRONTEND_SKILL.map((skill, i) => (
            <SkillDataProvider
              key={skill.skill_name}
              src={skill.image}
              name={skill.skill_name}
              width={skill.width}
              height={skill.height}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Backend row */}
      <div className="w-full mt-6">
        <h3 className="text-sm md:text-base text-gray-300/80 mb-3 text-center">Backend</h3>
        <div className="flex flex-row justify-center flex-wrap gap-6 items-center">
          {BACKEND_SKILL.map((skill, i) => (
            <SkillDataProvider
              key={skill.skill_name}
              src={skill.image}
              name={skill.skill_name}
              width={skill.width}
              height={skill.height}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Others row */}
      <div className="w-full mt-6">
        <h3 className="text-sm md:text-base text-gray-300/80 mb-3 text-center">Others</h3>
        <div className="flex flex-row justify-center flex-wrap gap-6 items-center">
          {DEVOPS_SKILL.map((skill, i) => (
            <SkillDataProvider
              key={skill.skill_name}
              src={skill.image}
              name={skill.skill_name}
              width={skill.width}
              height={skill.height}
              index={i}
            />
          ))}
          {OTHER_SKILL.map((skill, i) => (
            <SkillDataProvider
              key={skill.skill_name}
              src={skill.image}
              name={skill.skill_name}
              width={skill.width}
              height={skill.height}
              index={i + DEVOPS_SKILL.length}
            />
          ))}
        </div>
      </div>

      <div className="w-full h-full absolute">
        <div className="w-full h-full z-[-10] opacity-30 absolute flex items-center justify-center bg-cover">
          <video
            className="w-full h-auto"
            preload="false"
            playsInline
            loop
            muted
            autoPlay
          >
            <source src="/videos/skills-bg.webm" type="video/webm" />
          </video>
        </div>
      </div>
    </section>
  );
};
