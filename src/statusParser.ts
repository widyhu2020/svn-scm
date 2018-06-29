import * as xml2js from "xml2js";
import { camelcase } from "./util";

interface IWcStatus {
  locked: boolean;
  switched: boolean;
}

export interface IFileStatus {
  status: string;
  props: string;
  path: string;
  changelist?: string;
  rename?: string;
  wcStatus: IWcStatus;
  commit?: {
    revision: string;
    author: string;
    date: string;
  };
  repositoryUuid?: string;
  [key: number]: IFileStatus;
}

export interface IEntry {
  path: string;
  wcStatus: {
    item: string;
    revision: string;
    props: string;
    movedTo?: string;
    movedFrom?: string;
    wcLocked?: string;
    switched?: string;
    commit: {
      revision: string;
      author: string;
      date: string;
    };
  };
}

function processEntry(
  entry: IEntry | IEntry[],
  changelist?: string
): IFileStatus[] {
  if (Array.isArray(entry)) {
    const list: IFileStatus[] = [];
    entry.forEach((e: any) => {
      const r = processEntry(e, changelist);
      if (r) {
        list.push(...r);
      }
    });
    return list;
  }

  const wcStatus: IWcStatus = {
    locked: !!entry.wcStatus.wcLocked && entry.wcStatus.wcLocked === "true",
    switched: !!entry.wcStatus.switched && entry.wcStatus.switched === "true"
  };

  const r: IFileStatus = {
    changelist,
    path: entry.path,
    status: entry.wcStatus.item,
    props: entry.wcStatus.props,
    wcStatus
  };

  if (entry.wcStatus.movedTo && r.status === "deleted") {
    return [];
  }
  if (entry.wcStatus.movedFrom && r.status === "added") {
    r.rename = entry.wcStatus.movedFrom;
  }
  if (entry.wcStatus.commit) {
    r.commit = {
      revision: entry.wcStatus.commit.revision,
      author: entry.wcStatus.commit.author,
      date: entry.wcStatus.commit.date
    };
  }

  return [r];
}

function xmlToStatus(xml: any) {
  const statusList: IFileStatus[] = [];
  if (xml.target && xml.target.entry) {
    statusList.push(...processEntry(xml.target.entry));
  }

  if (xml.changelist) {
    if (!Array.isArray(xml.changelist)) {
      xml.changelist = [xml.changelist];
    }

    xml.changelist.forEach((change: any) => {
      statusList.push(...processEntry(change.entry, change.name));
    });
  }

  return statusList;
}

export async function parseStatusXml(content: string): Promise<IFileStatus[]> {
  return new Promise<IFileStatus[]>((resolve, reject) => {
    xml2js.parseString(
      content,
      {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        attrNameProcessors: [camelcase],
        tagNameProcessors: [camelcase]
      },
      (err, result) => {
        if (err) {
          reject();
        }

        const statusList: IFileStatus[] = xmlToStatus(result);

        resolve(statusList);
      }
    );
  });
}
