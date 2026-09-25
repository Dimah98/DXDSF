import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getProjectVarsPath,
  getSaveVarsPath,
  loadProjectVariables,
  saveProjectVariables
} from './variableStorage';
import { PROJECTS_DIR } from '../constants';

describe('VariableStorage', () => {
  const testProject = 'test_unit_project_temp';
  const testVarsPath = getProjectVarsPath(testProject);
  const testProjectPath = path.join(PROJECTS_DIR, `${testProject}.json`);

  beforeEach(async () => {
    // Clean up test files if any
    try { await fs.promises.unlink(testVarsPath); } catch {}
    try { await fs.promises.unlink(testProjectPath); } catch {}
  });

  afterEach(async () => {
    try { await fs.promises.unlink(testVarsPath); } catch {}
    try { await fs.promises.unlink(testProjectPath); } catch {}
  });

  it('returns empty object when no file exists', async () => {
    const vars = await loadProjectVariables(testProject);
    expect(vars).toEqual({});
  });

  it('saves and loads variables to/from dedicated _vars.json', async () => {
    const sampleVars = { sunflower: 120, wood: 45, isBotActive: true };
    await saveProjectVariables(testProject, sampleVars);

    expect(fs.existsSync(testVarsPath)).toBe(true);

    const loaded = await loadProjectVariables(testProject);
    expect(loaded).toEqual(sampleVars);
  });

  it('migrates legacy variables from main project JSON when _vars.json is missing', async () => {
    const legacyProjectData = {
      nodes: [{ id: '1', type: 'start' }],
      edges: [],
      variables: { gold: 999, stone: 50 }
    };
    await fs.promises.writeFile(testProjectPath, JSON.stringify(legacyProjectData, null, 2), 'utf-8');

    // _vars.json does not exist yet
    expect(fs.existsSync(testVarsPath)).toBe(false);

    // loadProjectVariables should read legacy and create _vars.json
    const loaded = await loadProjectVariables(testProject);
    expect(loaded).toEqual({ gold: 999, stone: 50 });

    // Verify _vars.json was auto-migrated
    expect(fs.existsSync(testVarsPath)).toBe(true);
    const raw = await fs.promises.readFile(testVarsPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual({ gold: 999, stone: 50 });
  });

  it('handles default project save_vars.json path correctly', () => {
    const saveVars = getSaveVarsPath();
    expect(saveVars).toContain('save_vars.json');
  });
});
