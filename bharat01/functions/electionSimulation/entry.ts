import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runSimulation, runAgentSelfTests, runSample } from "../../shared/electionAgents/index.ts";

// Election simulation endpoint — deterministic agent pipeline
// (Demographic + Anti-Incumbency → Voter → Election). No LLM is ever used to
// calculate votes. Actions: "simulate" (default), "selfTest", "sample".

export default async function (req: Request): Promise<Response> {
  try {
    const bharat01 = createClientFromRequest(req);
    const user = await bharat01.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const action = body.action || "simulate";

    if (action === "selfTest") {
      return Response.json(runAgentSelfTests());
    }
    if (action === "sample") {
      return Response.json(runSample());
    }
    if (action === "simulate") {
      const constituencies = body.constituencies;
      if (!Array.isArray(constituencies) || constituencies.length === 0) {
        return Response.json({ error: "constituencies array is required" }, { status: 400 });
      }
      const result = runSimulation(constituencies, body.weights, body.antiIncumbencyRange);
      return Response.json(result);
    }
    return Response.json({ error: "Unknown action: " + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error && error.message) || "simulation failed" }, { status: 500 });
  }
}