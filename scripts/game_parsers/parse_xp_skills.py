import re
import json

# Parse XP table from HTML
def parse_xp_table(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract table rows with level, total XP, level XP, skill points
    pattern = r'<tr><td class="b">(\d+)</td><td class="ta-right">([0-9,&nbsp;]+)</td><td class="ta-right text-secondary small">([0-9,&nbsp;]*)</td><td class="ta-right">\+1 \((\d+)\)</td>'
    matches = re.findall(pattern, content)
    
    xp_table = {}
    for match in matches:
        level = int(match[0])
        total_xp = int(match[1].replace('&nbsp;', '').replace(',', ''))
        xp_table[level] = total_xp
    
    return xp_table

# Parse skills table from HTML
def parse_skills_table(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract skill name and points
    pattern = r'<td class="ta-left b">([^<]+)</td><td>(\d+)</td>'
    matches = re.findall(pattern, content)
    
    skills_cost = {}
    for match in matches:
        skill_name = match[0].strip()
        cost = int(match[1])
        skills_cost[skill_name] = cost
    
    return skills_cost

# Parse and save
xp_table = parse_xp_table(r'd:\SF\Bumpkin XP - Sunflower Land Expansion.html')
skills_cost = parse_skills_table(r'd:\SF\Revamp Skills Tree - Sunflower Land.html')

print("XP Table (Level -> Total XP):")
for level in sorted(xp_table.keys())[:10]:
    print(f"  Level {level}: {xp_table[level]} XP")

print(f"\nTotal levels: {len(xp_table)}")
print(f"Max level: {max(xp_table.keys())}")
print(f"Max XP: {max(xp_table.values())}")

print("\nSkills Cost:")
for skill, cost in list(skills_cost.items())[:10]:
    print(f"  {skill}: {cost} points")

print(f"\nTotal skills: {len(skills_cost)}")

# Save to JSON
output = {
    "xp_table": xp_table,
    "skills_cost": skills_cost
}

with open(r'd:\SF\skill_points_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print("\nSaved to skill_points_data.json")
